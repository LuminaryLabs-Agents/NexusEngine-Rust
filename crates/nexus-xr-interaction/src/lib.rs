use nexus_adaptive_host::{GrabInteractionDescriptor, XrInputFrame};

#[derive(Debug, Clone, PartialEq)]
pub enum GrabEvent {
    Hover { object_id: String },
    Started { object_id: String, hand: usize },
    Held { object_id: String, hand: usize },
    Released { object_id: String, velocity: [f32; 3] },
}

#[derive(Debug, Clone, Default)]
pub struct GrabRuntime {
    held: Option<(String, usize, [f32; 3])>,
}

impl GrabRuntime {
    pub fn tick(&mut self, input: &XrInputFrame, grabbables: &[GrabInteractionDescriptor]) -> Vec<GrabEvent> {
        let Some(target) = grabbables.first() else { return Vec::new(); };
        let hand_index = if input.hands[1].active { 1 } else { 0 };
        let hand = input.hands[hand_index];
        let mut events = Vec::new();

        if hand.active && self.held.is_none() {
            events.push(GrabEvent::Hover { object_id: target.object_id.clone() });
        }

        if hand.active && hand.grip_pressed {
            match &self.held {
                Some((id, held_hand, _)) if *held_hand == hand_index => {
                    events.push(GrabEvent::Held { object_id: id.clone(), hand: hand_index });
                }
                _ => {
                    self.held = Some((target.object_id.clone(), hand_index, hand.pose.position));
                    events.push(GrabEvent::Started { object_id: target.object_id.clone(), hand: hand_index });
                }
            }
        } else if let Some((id, _, previous)) = self.held.take() {
            let velocity = [
                (hand.pose.position[0] - previous[0]) * target.throw_scale,
                (hand.pose.position[1] - previous[1]) * target.throw_scale,
                (hand.pose.position[2] - previous[2]) * target.throw_scale,
            ];
            events.push(GrabEvent::Released { object_id: id, velocity });
        }

        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nexus_adaptive_host::{HandInput, Pose, XrInputFrame};

    #[test]
    fn grip_starts_and_release_throws() {
        let mut runtime = GrabRuntime::default();
        let grabbables = vec![GrabInteractionDescriptor {
            object_id: "blue-cube".to_string(),
            mode: "near-or-ray".to_string(),
            radius: 0.18,
            mass: 1.0,
            throw_scale: 2.0,
        }];
        let mut hand = HandInput::default();
        hand.active = true;
        hand.grip_pressed = true;
        hand.pose = Pose { position: [0.0, 0.0, 0.0], orientation: [0.0, 0.0, 0.0, 1.0] };
        let input = XrInputFrame { frame: 1, predicted_display_time_ns: 0, head_pose: Pose::default(), hands: [HandInput::default(), hand] };
        assert!(matches!(runtime.tick(&input, &grabbables)[1], GrabEvent::Started { .. }));

        let mut release_hand = hand;
        release_hand.grip_pressed = false;
        release_hand.pose.position = [0.5, 0.0, 0.0];
        let release = XrInputFrame { frame: 2, predicted_display_time_ns: 0, head_pose: Pose::default(), hands: [HandInput::default(), release_hand] };
        let events = runtime.tick(&release, &grabbables);
        assert!(matches!(events[0], GrabEvent::Released { velocity: [1.0, 0.0, 0.0], .. }));
    }
}
