import type { ReactNode } from "react";
import { Modal as UIModal } from "@rymel/ui";

/**
 * Adaptador del `Modal` de @rymel/ui con las props antiguas del cliente
 * (`isOpen`, `closeOnOutsideClick`, tamaños md/lg/xl/full). Para código
 * nuevo usa `Modal` de `@rymel/ui`, que además acepta `icon`,
 * `description` y `footer`.
 */
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  closeOnOutsideClick?: boolean;
};

const SIZES = { md: "sm", lg: "md", xl: "md", full: "xl" } as const;

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "lg",
  closeOnOutsideClick = true,
}: ModalProps) {
  return (
    <UIModal
      open={isOpen}
      onClose={onClose}
      title={title ?? ""}
      size={SIZES[size]}
      dismissable={closeOnOutsideClick}
    >
      {children}
    </UIModal>
  );
}
