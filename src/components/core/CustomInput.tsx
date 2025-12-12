import type React from "react";
import { useState } from "react";
import { MdOutlineClose } from "react-icons/md";
import { HiEye, HiEyeOff } from "react-icons/hi";

interface CustomInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  leftIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

const CustomInput: React.FC<CustomInputProps> = ({
  value,
  onChange,
  onClear,
  leftIcon,
  showPasswordToggle = false,
  placeholder = "Escribe aquí...",
  className = "",
  type = "text",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  const inputType =
    showPasswordToggle && type === "password"
      ? showPassword
        ? "text"
        : "password"
      : type;

  const hasRightIcon = value || showPasswordToggle;

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          {leftIcon}
        </div>
      )}
      <input
        {...props}
        type={inputType}
        value={value}
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className={`w-full h-full py-2 text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-400 ${
          leftIcon ? "pl-10" : "pl-4"
        } ${hasRightIcon ? "pr-10" : "pr-4"}`}
      />
      {showPasswordToggle && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none z-20"
        >
          {showPassword ? (
            <HiEyeOff className="h-5 w-5" />
          ) : (
            <HiEye className="h-5 w-5" />
          )}
        </button>
      )}
      {value && !showPasswordToggle && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
        >
          <MdOutlineClose size={18} />
        </button>
      )}
    </div>
  );
};

export default CustomInput;
