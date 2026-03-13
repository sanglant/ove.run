## Design Context

### Users
ove.run is for a broad developer audience, especially people exploring, adopting, or actively using AI coding agents in real workflows. They are evaluating or using a terminal-first desktop tool that helps them run agents, supervise output, preserve context, and stay in control instead of babysitting interruptions.

The core job to be done is to make advanced agent workflows feel understandable, trustworthy, and practical. The interface should help developers quickly grasp capability, feel oriented in complex workflows, and believe they can delegate more without losing oversight.

### Brand Personality
The brand personality is **smart, universal, powerful**. Its voice should feel confident, technically fluent, and useful without becoming cold or overbearing.

The primary emotional target is **confident and in control**. Future work should reinforce the sense that ove.run makes sophisticated agent workflows more manageable, more legible, and more dependable.

### Aesthetic Direction
Keep the product **dark-mode only** and preserve the existing warm **amber accent** direction. The current visual language already points the right way: terminal-inspired, technical, polished, slightly cinematic, and grounded in developer tooling rather than generic SaaS marketing.

The interface should feel modern and distinctive, but it should **not** drift into a generic SaaS dashboard look. It should also avoid empty sterility: strong contrast, clear hierarchy, and purposeful glow or motion are welcome when they support clarity and control.

### Design Principles
1. **Control over spectacle** — Visual choices should reinforce trust, legibility, and operator confidence before they chase novelty.
2. **Technical, not generic** — Lean into a developer-native aesthetic with terminal cues, system-like structure, and product-specific personality rather than interchangeable SaaS patterns.
3. **Power made approachable** — Complex capabilities should feel understandable at a glance through clear hierarchy, strong copy, and obvious interaction flows.
4. **Dark with disciplined warmth** — Use the dark foundation and amber accent consistently to create a recognizable brand signature without oversaturating the interface.
5. **Motion with respect** — Animation should clarify and elevate the experience, but every motion-heavy idea should remain compatible with reduced-motion needs and strong baseline accessibility.

## Shared UI System

- Shared UI primitives live in `src/components/ui`, while design tokens and app-level color variables live in `src/theme.ts`.
- Use `AppModal` for Mantine-backed dialogs instead of re-declaring the standard modal chrome, overlay, and transition props inline.
- `AppModal` is the shared modal shell for app dialogs. Use its `bodyPadding` prop for compact confirmation dialogs, and pass `styles` only for real layout overrides like custom widths or scroll regions.
