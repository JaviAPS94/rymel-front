import type React from "react";
import { useState } from "react";
import { HiEye, HiEyeOff } from "react-icons/hi";
import { Input } from "@rymel/ui";

/**
 * Adaptador del `Input` de @rymel/ui con la API antigua del cliente:
 * `onChange` recibe el texto. Para código nuevo usa `Input` de `@rymel/ui`.
 */
interface CustomInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  leftIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  size?: "md" | "lg";
  /** Texto monoespaciado: códigos, referencias. */
  mono?: boolean;
}

const CustomInput: React.FC<CustomInputProps> = ({
  value,
  onChange,
  onClear,
  showPasswordToggle = false,
  placeholder = "Escribe aquí...",
  type = "text",
  onClick,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = showPasswordToggle && type === "password";

  return (
    <Input
      {...props}
      type={isPassword && showPassword ? "text" : type}
      value={value}
      placeholder={placeholder}
      // Dentro de filas y tarjetas clicables, escribir no debe activarlas.
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      onChange={(event) => {
        event.stopPropagation();
        onChange(event.target.value);
      }}
      onClear={
        isPassword
          ? undefined
          : () => {
              onChange("");
              onClear?.();
            }
      }
      rightSlot={
        isPassword && (
          <button
            type="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((shown) => !shown)}
            className="flex shrink-0 text-gray-400 hover:text-gray-700"
          >
            {showPassword ? <HiEyeOff className="h-5 w-5" /> : <HiEye className="h-5 w-5" />}
          </button>
        )
      }
    />
  );
};

export default CustomInput;
