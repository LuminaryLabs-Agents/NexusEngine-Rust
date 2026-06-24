use jni::objects::{JClass, JString};
use jni::sys::jstring;
use jni::JNIEnv;
use nexus_host::HostRuntime;
use once_cell::sync::Lazy;
use std::sync::Mutex;

static RUNTIME: Lazy<Mutex<Option<HostRuntime>>> = Lazy::new(|| Mutex::new(None));
static XR_LIFECYCLE: Lazy<Mutex<XrLifecycleState>> = Lazy::new(|| Mutex::new(XrLifecycleState::default()));

#[derive(Debug, Clone)]
struct XrLifecycleState {
    initialized: bool,
    resumed: bool,
    stage: String,
}

impl Default for XrLifecycleState {
    fn default() -> Self {
        Self {
            initialized: false,
            resumed: false,
            stage: "NotStarted".to_string(),
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_dev_luminarylabs_nexusrealtime_MainActivity_nativeInit(
    mut env: JNIEnv,
    _class: JClass,
    sequence_json: JString,
    manifest_json: JString,
) -> jstring {
    let sequence = read_java_string(&mut env, &sequence_json);
    let manifest = read_java_string(&mut env, &manifest_json);

    let status = match HostRuntime::from_json(&sequence, &manifest) {
        Ok(mut runtime) => {
            runtime.start();
            let status = runtime.status();
            if let Ok(mut slot) = RUNTIME.lock() {
                *slot = Some(runtime);
            }
            status
        }
        Err(error) => format!("Nexus host init failed: {error}"),
    };

    java_string(&mut env, &status)
}

#[no_mangle]
pub extern "system" fn Java_dev_luminarylabs_nexusrealtime_MainActivity_nativeStartOpenXr(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let status = match XR_LIFECYCLE.lock() {
        Ok(mut state) => {
            state.initialized = true;
            state.stage = "LoaderReady>InstanceReady>SessionReady(scaffold)".to_string();
            format!("native WebXR/OpenXR adapter scaffold started: {}", state.stage)
        }
        Err(_) => "native WebXR/OpenXR lifecycle lock failed".to_string(),
    };
    java_string(&mut env, &status)
}

#[no_mangle]
pub extern "system" fn Java_dev_luminarylabs_nexusrealtime_MainActivity_nativeOnResume(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let status = match XR_LIFECYCLE.lock() {
        Ok(mut state) => {
            state.resumed = true;
            format!("native WebXR/OpenXR adapter resumed: {}", state.stage)
        }
        Err(_) => "native WebXR/OpenXR lifecycle lock failed".to_string(),
    };
    java_string(&mut env, &status)
}

#[no_mangle]
pub extern "system" fn Java_dev_luminarylabs_nexusrealtime_MainActivity_nativeOnPause(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let status = match XR_LIFECYCLE.lock() {
        Ok(mut state) => {
            state.resumed = false;
            format!("native WebXR/OpenXR adapter paused: {}", state.stage)
        }
        Err(_) => "native WebXR/OpenXR lifecycle lock failed".to_string(),
    };
    java_string(&mut env, &status)
}

#[no_mangle]
pub extern "system" fn Java_dev_luminarylabs_nexusrealtime_MainActivity_nativeShutdown(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let status = match XR_LIFECYCLE.lock() {
        Ok(mut state) => {
            state.initialized = false;
            state.resumed = false;
            state.stage = "Shutdown".to_string();
            "native WebXR/OpenXR adapter shutdown".to_string()
        }
        Err(_) => "native WebXR/OpenXR lifecycle lock failed".to_string(),
    };
    java_string(&mut env, &status)
}

#[no_mangle]
pub extern "system" fn Java_dev_luminarylabs_nexusrealtime_MainActivity_nativeTick(
    mut env: JNIEnv,
    _class: JClass,
    dt: f32,
) -> jstring {
    let status = match RUNTIME.lock() {
        Ok(mut slot) => match slot.as_mut() {
            Some(runtime) => {
                let buffer = runtime.tick(dt);
                let xr = XR_LIFECYCLE
                    .lock()
                    .map(|state| state.stage.clone())
                    .unwrap_or_else(|_| "XrLifecycleUnavailable".to_string());
                format!("{} | {} | xr={}", runtime.status(), buffer.summary(), xr)
            }
            None => "Nexus host is not initialized".to_string(),
        },
        Err(_) => "Nexus host runtime lock failed".to_string(),
    };

    java_string(&mut env, &status)
}

fn read_java_string(env: &mut JNIEnv, value: &JString) -> String {
    env.get_string(value)
        .map(|text| text.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn java_string(env: &mut JNIEnv, value: &str) -> jstring {
    env.new_string(value)
        .map(|text| text.into_raw())
        .unwrap_or(std::ptr::null_mut())
}
