import React from "react";
import { FaRegQuestionCircle, FaExclamationTriangle } from "react-icons/fa";
import classNames from "classnames";

interface NoDataProps {
  message?: string;
  className?: string;
  type?: "nodata" | "error";
}

const NoData: React.FC<NoDataProps> = ({
  message = "No data available",
  className,
  type = "nodata",
}) => {
  const isError = type === "error";
  const icon = isError ? (
    <FaExclamationTriangle className="w-12 h-12 text-red-500" />
  ) : (
    <FaRegQuestionCircle className="w-12 h-12 text-primary" />
  );

  const defaultMessage = isError ? "Something went wrong" : "No data available";
  const iconBgClass = isError ? "bg-red-50" : "bg-primary/10";
  const titleText = isError ? "Error!" : "Oops!";

  return (
    <div
      className={classNames(
        "flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg shadow-inner",
        className
      )}
    >
      <div
        className={classNames(
          "p-6 rounded-full mb-4 flex items-center justify-center",
          iconBgClass
        )}
      >
        {icon}
      </div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">{titleText}</h2>
      <p className="text-gray-600 text-center max-w-sm">
        {message || defaultMessage}
      </p>
    </div>
  );
};

export default NoData;
