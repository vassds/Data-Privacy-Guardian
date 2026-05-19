use wasm_bindgen::prelude::*;
use url::Url;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub is_tracker: bool,
    pub risk_score: u8,
    pub tracker_type: String,
    pub rule_matched: String,
}

#[wasm_bindgen]
pub struct PrivacyEngine {
    known_trackers: Vec<String>,
}

#[wasm_bindgen]
impl PrivacyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PrivacyEngine {
        PrivacyEngine {
            known_trackers: vec![
                "google-analytics.com".to_string(),
                "doubleclick.net".to_string(),
                "facebook.net".to_string(),
                "scorecardresearch.com".to_string(),
                "adnxs.com".to_string(),
            ],
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
                for tracker in &self.known_trackers {
                    if host.contains(tracker) {
                        result.is_tracker = true;
                        result.risk_score = 85;
                        result.tracker_type = "Tracking/Advertising".to_string();
                        result.rule_matched = tracker.clone();
                        break;
                    }
                }
            }
        }

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }
}