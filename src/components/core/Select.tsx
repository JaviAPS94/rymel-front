import { Select as UISelect } from "@rymel/ui";

/**
 * Adaptador del `Select` de @rymel/ui con las props antiguas del cliente
 * (`selectedValue`, `isLoading`, errores por clave). Para código nuevo usa
 * `Select` de `@rymel/ui` directamente.
 */
export interface Option<T> {
  label: string;
  value: T;
}

interface Props<T> {
  options: Option<T>[] | undefined;
  selectedValue: T | null | undefined;
  onChange: (value: T | undefined) => void;
  isLoading: boolean;
  placeholder?: string;
  /** Errores del formulario; se muestra el de `errorKey`. */
  error?: Record<string, string>;
  errorKey?: string;
  disabled?: boolean;
  size?: "md" | "lg";
  className?: string;
}

const Select = <T,>({
  options,
  selectedValue,
  onChange,
  isLoading,
  placeholder,
  error,
  errorKey,
  disabled,
  size,
  className,
}: Props<T>) => {
  const message = error && errorKey ? error[errorKey] : undefined;
  return (
    <div className="w-full">
      <UISelect
        options={options}
        value={selectedValue}
        onChange={onChange}
        loading={isLoading}
        placeholder={placeholder}
        disabled={disabled}
        invalid={Boolean(message)}
        size={size}
        className={className}
      />
      {message && (
        <span role="alert" className="mt-1 block text-[13px] text-danger">
          {message}
        </span>
      )}
    </div>
  );
};

export default Select;
