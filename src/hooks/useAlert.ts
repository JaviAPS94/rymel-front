import { useState } from "react";

type AlertState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "warning" | "info";
};

export function useAlert() {
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    message: "",
    type: "success",
  });

  const showAlert = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "success",
    duration: number = 3000
  ) => {
    setAlert({ visible: true, message, type });

    if (duration > 0) {
      setTimeout(() => {
        setAlert({ ...alert, visible: false });
      }, duration);
    }
  };

  const hideAlert = () => setAlert({ ...alert, visible: false });

  return { alert, showAlert, hideAlert };
}
