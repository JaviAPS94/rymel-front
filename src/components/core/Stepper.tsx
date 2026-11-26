import { FaChevronRight, FaPlus, FaTimes } from "react-icons/fa";
import Button from "./Button";
import { JSX } from "react";

interface StepperProps {
  step: number;
  stepComponents: Record<
    number,
    { title?: string; content: JSX.Element; isFinalStep?: boolean }
  >;
  errorMessage?: string;
  onNextStep: () => void;
  onFinalAction: () => void;
  onCancel: () => void;
  finishFlow?: boolean;
}

const Stepper: React.FC<StepperProps> = ({
  step,
  stepComponents,
  errorMessage,
  onNextStep,
  onFinalAction,
  onCancel,
  finishFlow,
}) => {
  const currentStep = stepComponents[step];

  return (
    <>
      {currentStep?.title && (
        <h2 className="text-lg font-semibold text-gray-900">
          {currentStep?.title}
        </h2>
      )}

      <div className="mt-4 max-h-96 overflow-y-auto">
        {currentStep?.content || <p>No step found</p>}
      </div>

      {errorMessage && (
        <span className="text-red-500 text-sm">{errorMessage}</span>
      )}

      <div className="mt-6 flex flex-row-reverse justify-start gap-2">
        <Button
          primary
          onClick={
            currentStep.isFinalStep || finishFlow ? onFinalAction : onNextStep
          }
          icon={
            currentStep.isFinalStep || finishFlow ? (
              <FaPlus />
            ) : (
              <FaChevronRight />
            )
          }
        >
          {currentStep.isFinalStep || finishFlow ? "Finalizar" : "Continuar"}
        </Button>
        <Button base onClick={onCancel} icon={<FaTimes />}>
          Cancelar
        </Button>
      </div>
    </>
  );
};

export default Stepper;
