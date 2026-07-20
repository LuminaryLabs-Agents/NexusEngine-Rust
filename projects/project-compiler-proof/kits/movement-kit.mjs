export const movementKit = defineKit({
  id: "proof:movement",
  resources: {
    speed: 8,
    enabled: true,
    label: "Movement"
  },
  systems: [
    defineSystem({
      phase: "simulation",
      run(ctx) {
        const axis = ctx.input.axis("move");
        ctx.motion.movePlayer(axis, ctx.resources.speed);
      }
    })
  ]
});
