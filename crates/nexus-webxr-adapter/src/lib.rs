use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WebXrSessionMode {
    Inline,
    ImmersiveVr,
    ImmersiveAr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WebXrReferenceSpaceType {
    Viewer,
    Local,
    LocalFloor,
    BoundedFloor,
    Unbounded,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebXrSessionRequest {
    pub mode: WebXrSessionMode,
    #[serde(default)]
    pub required_features: Vec<String>,
    #[serde(default)]
    pub optional_features: Vec<String>,
}

impl WebXrSessionRequest {
    pub fn immersive_vr_local_floor() -> Self {
        Self {
            mode: WebXrSessionMode::ImmersiveVr,
            required_features: vec!["local-floor".to_string()],
            optional_features: vec!["hand-tracking".to_string(), "anchors".to_string(), "haptics".to_string()],
        }
    }

    pub fn requires_floor(&self) -> bool {
        self.required_features.iter().any(|feature| feature == "local-floor" || feature == "bounded-floor")
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebXrPose {
    pub position: [f32; 3],
    pub orientation: [f32; 4],
}

impl Default for WebXrPose {
    fn default() -> Self {
        Self { position: [0.0, 0.0, 0.0], orientation: [0.0, 0.0, 0.0, 1.0] }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebXrViewPacket {
    pub eye: String,
    pub pose: WebXrPose,
    pub projection: [f32; 16],
    pub viewport: [u32; 4],
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebXrInputSourcePacket {
    pub handedness: String,
    pub target_ray_mode: String,
    pub grip_pose: Option<WebXrPose>,
    pub target_ray_pose: Option<WebXrPose>,
    pub profiles: Vec<String>,
    pub buttons: Vec<String>,
    pub axes: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebXrLayerPacket {
    pub layer_id: String,
    pub eye_count: u8,
    pub swapchain_policy: String,
    pub color_format: String,
    pub depth_format: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebXrFramePacket {
    pub frame_index: u64,
    pub predicted_display_time_ns: u64,
    pub reference_space: WebXrReferenceSpaceType,
    pub views: Vec<WebXrViewPacket>,
    pub input_sources: Vec<WebXrInputSourcePacket>,
    pub layer: WebXrLayerPacket,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WebXrHostCapabilities {
    pub supports_immersive_vr: bool,
    pub supports_immersive_ar: bool,
    pub supports_local_floor: bool,
    pub supports_hand_tracking: bool,
    pub supports_haptics: bool,
    pub supports_projection_layer: bool,
    pub preferred_backend: String,
}

impl WebXrHostCapabilities {
    pub fn quest_openxr_vulkan() -> Self {
        Self {
            supports_immersive_vr: true,
            supports_immersive_ar: false,
            supports_local_floor: true,
            supports_hand_tracking: false,
            supports_haptics: true,
            supports_projection_layer: true,
            preferred_backend: "vulkan".to_string(),
        }
    }

    pub fn supports_request(&self, request: &WebXrSessionRequest) -> bool {
        let mode_supported = match request.mode {
            WebXrSessionMode::Inline => true,
            WebXrSessionMode::ImmersiveVr => self.supports_immersive_vr,
            WebXrSessionMode::ImmersiveAr => self.supports_immersive_ar,
        };

        mode_supported && (!request.requires_floor() || self.supports_local_floor)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenXrBackendMapping {
    pub request_session: &'static str,
    pub wait_frame: &'static str,
    pub locate_views: &'static str,
    pub sync_actions: &'static str,
    pub submit_frame: &'static str,
}

pub fn openxr_mapping() -> OpenXrBackendMapping {
    OpenXrBackendMapping {
        request_session: "xrCreateSession",
        wait_frame: "xrWaitFrame/xrBeginFrame",
        locate_views: "xrLocateViews",
        sync_actions: "xrSyncActions/xrLocateSpace",
        submit_frame: "xrEndFrame",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quest_capabilities_support_immersive_vr_local_floor() {
        let caps = WebXrHostCapabilities::quest_openxr_vulkan();
        assert!(caps.supports_request(&WebXrSessionRequest::immersive_vr_local_floor()));
        assert_eq!(caps.preferred_backend, "vulkan");
    }

    #[test]
    fn openxr_mapping_names_native_calls() {
        let mapping = openxr_mapping();
        assert_eq!(mapping.request_session, "xrCreateSession");
        assert!(mapping.submit_frame.contains("xrEndFrame"));
    }
}
