export const MODAL_STYLES = {
  header: {
    backgroundColor: "var(--bg-elevated)",
    borderBottom: "1px solid var(--border)",
    padding: "16px 20px",
  },
  title: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: 600,
  },
  body: {
    padding: 0,
    backgroundColor: "var(--bg-elevated)",
  },
  content: {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border-bright)",
  },
  close: {
    color: "var(--text-secondary)",
  },
};

export const MODAL_OVERLAY_PROPS = { blur: 3, backgroundOpacity: 0.6 };
export const MODAL_TRANSITION_PROPS = { transition: "slide-up" as const };

export const INPUT_STYLES = {
  input: {
    backgroundColor: "var(--bg-tertiary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
    "&::placeholder": { color: "var(--text-secondary)" },
    "&:focus": { borderColor: "var(--accent)" },
  },
  label: {
    color: "var(--text-secondary)",
    fontSize: "10px",
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
};

export const BUTTON_STYLES = {
  primary: {
    root: {
      backgroundColor: "var(--accent)",
      color: "var(--bg-primary)",
      "&:hover": { backgroundColor: "var(--accent-hover)" },
      "&:disabled": { opacity: 0.5 },
    },
  },
  subtle: {
    root: {
      color: "var(--text-secondary)",
      "&:hover": {
        color: "var(--text-primary)",
        backgroundColor: "transparent",
      },
    },
  },
};

export const switchStyles = (active: boolean) => ({
  track: {
    backgroundColor: active ? undefined : "var(--bg-tertiary)",
    borderColor: "var(--bg-tertiary)",
  },
});
