import className from "classnames";
import { GoSync } from "react-icons/go";
import {
  Button as UIButton,
  type ButtonSize,
  type ButtonVariant,
} from "@rymel/ui";

/**
 * Adaptador del botón de @rymel/ui con las props antiguas del cliente.
 *
 * Con variante (o un atajo: `primary`, `base`, `danger`, `outline`…) pinta el
 * `Button` del sistema de diseño. Para código nuevo usa `Button` de
 * `@rymel/ui` con `variant` directamente.
 *
 * Sin variante queda solo la caja y el aspecto lo pone quien lo usa
 * (pestañas de hoja, celdas de la tabla…).
 */
export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Estado «encendido» de un botón que alterna un modo. */
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactElement;

  primary?: boolean;
  danger?: boolean;
  base?: boolean;
  cancel?: boolean;
  outline?: boolean;
  /** @deprecated usa `variant="primary"` */
  success?: boolean;
  /** @deprecated usa `variant="secondary"` */
  warning?: boolean;
  /** @deprecated usa `variant="secondary"` */
  highlight?: boolean;
  /** @deprecated usa `variant="secondary"` */
  info?: boolean;
  /** @deprecated usa `variant="secondary"` */
  baseFill?: boolean;
  rounded?: boolean;
}

const Button = ({
  children,
  variant,
  size = "md",
  active,
  primary,
  success,
  warning,
  danger,
  cancel,
  highlight,
  info,
  base,
  baseFill,
  rounded,
  loading,
  disabled,
  outline,
  icon,
  ...rest
}: ButtonProps) => {
  const resolved: ButtonVariant | undefined =
    variant ??
    (danger
      ? "danger"
      : primary || success
        ? "primary"
        : base || cancel || warning || highlight || info || baseFill
          ? "secondary"
          : outline
            ? "ghost"
            : undefined);

  if (resolved) {
    return (
      <UIButton
        {...rest}
        variant={resolved}
        size={size}
        active={active}
        loading={loading}
        disabled={disabled}
        icon={icon}
        className={className(rounded && "!rounded-full", rest.className)}
      >
        {children}
      </UIButton>
    );
  }

  return (
    <button
      {...rest}
      disabled={loading || disabled}
      className={className(
        "flex items-center justify-center px-3 py-1.5 border rounded",
        rest.className,
        {
          "opacity-60 cursor-not-allowed": loading || disabled,
          "rounded-full": rounded,
        },
      )}
    >
      {loading ? (
        <GoSync className="animate-spin" />
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
