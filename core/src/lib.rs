use wasm_bindgen::prelude::*;
use url::Url;
use serde::{Serialize, Deserialize};
use std::collections::HashSet;
use regex::Regex;

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub is_tracker: bool,
    pub risk_score: u8,
    pub tracker_type: String,
    pub rule_matched: String,
}

#[wasm_bindgen]
pub struct PrivacyEngine {
    blocked_domains: HashSet<String>,
    url_patterns: Vec<Regex>,
}

#[wasm_bindgen]
impl PrivacyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PrivacyEngine {
        // PRE-COMPILE HEURISTIC RULES
        // These regex patterns catch trackers regardless of the domain they hide on.
        let patterns = vec![
            // Catches tracking parameters in the URL
            Regex::new(r"(?i)[?&](utm_source=|click_id=|fbclid=|gclid=|msclkid=)").unwrap(),
            // Catches standard tracking script payloads
            Regex::new(r"(?i)/(analytics|track|telemetry|beacon|metrics)\.js").unwrap(),
            // Catches invisible 1x1 tracking pixels
            Regex::new(r"(?i)(pixel|1x1)\.(gif|png)").unwrap(),
        ];

        PrivacyEngine {
            blocked_domains: HashSet::new(),
            url_patterns: patterns,
        }
    }

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

        // 1. DEEP URL INSPECTION (Heuristics)
        for pattern in &self.url_patterns {
            if pattern.is_match(request_url) {
                result.is_tracker = true;
                result.risk_score = 95;
                result.tracker_type = "Algorithmic/Heuristic Payload".to_string();
                result.rule_matched = "Deep URL/Heuristic Match".to_string();
                return serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL);
            }
        }

        // 2. DOMAIN MATCHING (O(1) HashSet Lookup)
        if let Ok(parsed_url) = Url::parse(request_url) {
            if let Some(host) = parsed_url.host_str() {
                // Check the exact host
                if self.blocked_domains.contains(host) {
                    result.is_tracker = true;
                    result.risk_score = 85;
                    result.tracker_type = "Known Tracking Domain".to_string();
                    result.rule_matched = host.to_string();
                    return serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL);
                }

                // Check the base domain (e.g., catches metrics.cnn.com if cnn.com is blocked)
                let parts: Vec<&str> = host.split('.').collect();
                if parts.len() >= 2 {
                    let base_domain = format!("{}.{}", parts[parts.len() - 2], parts[parts.len() - 1]);
                    if self.blocked_domains.contains(&base_domain) {
                        result.is_tracker = true;
                        result.risk_score = 85;
                        result.tracker_type = "Known Base Domain".to_string();
                        result.rule_matched = base_domain;
                        return serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL);
                    }
                }
            }
        }

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }
}