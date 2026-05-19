use wasm_bindgen::prelude::*;
use url::Url;
use serde::{Serialize, Deserialize};
use std::collections::HashSet;

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub is_tracker: bool,
    pub risk_score: u8,
    pub tracker_type: String,
    pub rule_matched: String,
}

#[wasm_bindgen]
pub struct PrivacyEngine {
    // Upgraded to a fast HashSet for O(1) lookups of thousands of domains
    blocked_domains: HashSet<String>,
}

#[wasm_bindgen]
impl PrivacyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PrivacyEngine {
        PrivacyEngine {
            blocked_domains: HashSet::new(),
        }
    }

    // NEW: Allow TypeScript to feed thousands of rules into Rust memory instantly
    pub fn load_rules(&mut self, rules_string: &str) {
        for line in rules_string.lines() {
            let clean_line = line.trim();
            if !clean_line.is_empty() && !clean_line.starts_with('#') {
                self.blocked_domains.insert(clean_line.to_string());
            }
        }
    }

    pub fn analyze_url(&self, request_url: &str) -> JsValue {
        let mut result = AnalysisResult {
            is_tracker: false,
            risk_score: 0,
            tracker_type: "clean".to_string(),
            rule_matched: "none".to_string(),
        };

        if let Ok(parsed_url) = Url::parse(request_url) {
            if let Some(host) = parsed_url.host_str() {
                // In a production app, you'd check parent domains too (e.g., matching google-analytics.com against sub.google-analytics.com)
                for domain in &self.blocked_domains {
                    if host.contains(domain) {
                        result.is_tracker = true;
                        result.risk_score = 85;
                        result.tracker_type = "Tracking/Advertising".to_string();
                        result.rule_matched = domain.clone();
                        break;
                    }
                }
            }
        }

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }
}