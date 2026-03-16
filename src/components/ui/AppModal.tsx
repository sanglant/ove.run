import { Modal, type ModalProps } from "@mantine/core";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS } from "@/constants/styles";

interface AppModalProps extends Omit<ModalProps, "overlayProps" | "transitionProps"> {
  bodyPadding?: number;
}

export function AppModal({ bodyPadding, styles, ...rest }: AppModalProps) {
  const mergedStyles =
    bodyPadding != null || styles
      ? {
          ...MODAL_STYLES,
          ...(typeof styles === "object" ? styles : {}),
          body: {
            ...MODAL_STYLES.body,
            ...(typeof styles === "object" && styles && "body" in styles
              ? (styles as Record<string, unknown>).body as Record<string, unknown>
              : {}),
            ...(bodyPadding != null ? { padding: bodyPadding } : {}),
          },
        }
      : MODAL_STYLES;

  return (
    <Modal
      overlayProps={MODAL_OVERLAY_PROPS}
      transitionProps={MODAL_TRANSITION_PROPS}
      styles={mergedStyles}
      {...rest}
    />
  );
}
