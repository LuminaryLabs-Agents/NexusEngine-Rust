use nexus_adaptive_host::StereoRenderDescriptor;

#[derive(Debug, Clone, PartialEq)]
pub struct ToonRamp {
    pub bands: [f32; 4],
}

impl Default for ToonRamp {
    fn default() -> Self {
        Self { bands: [0.42, 0.62, 0.82, 1.08] }
    }
}

pub fn toon_band(ndot_l: f32) -> usize {
    let v = ndot_l.clamp(0.0, 1.0);
    if v < 0.25 { 0 } else if v < 0.50 { 1 } else if v < 0.75 { 2 } else { 3 }
}

pub fn shade_toon(base: [f32; 3], ndot_l: f32, ramp: &ToonRamp) -> [f32; 3] {
    let k = ramp.bands[toon_band(ndot_l)];
    [(base[0] * k).min(1.0), (base[1] * k).min(1.0), (base[2] * k).min(1.0)]
}

pub fn sigmoid_outline(edge: f32, threshold: f32, slope: f32) -> f32 {
    1.0 / (1.0 + (-(edge - threshold) * slope).exp())
}

pub fn gradient_sky(y: f32, zenith: [f32; 3], horizon: [f32; 3]) -> [f32; 3] {
    let t = y.clamp(0.0, 1.0);
    [
        horizon[0] * (1.0 - t) + zenith[0] * t,
        horizon[1] * (1.0 - t) + zenith[1] * t,
        horizon[2] * (1.0 - t) + zenith[2] * t,
    ]
}

pub fn default_stereo_descriptor() -> StereoRenderDescriptor {
    StereoRenderDescriptor::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toon_band_has_four_regions() {
        assert_eq!(toon_band(0.1), 0);
        assert_eq!(toon_band(0.3), 1);
        assert_eq!(toon_band(0.6), 2);
        assert_eq!(toon_band(0.9), 3);
    }

    #[test]
    fn outline_sigmoid_increases_with_edge() {
        assert!(sigmoid_outline(0.2, 0.1, 20.0) > sigmoid_outline(0.0, 0.1, 20.0));
    }
}
