import { useNavigate, useParams } from "react-router-dom";
import DesignViewer from "../components/design/DesignViewer";
import { useGetDesignByIdQuery } from "../store";
import Skeleton from "../components/core/skeletons/Skeleton";
import { useErrorAlert } from "../hooks/useAlertError";
import Alert from "../components/core/Alert";
import Button from "../components/core/Button";

const DesignDetailsPage = () => {
  const navigate = useNavigate();
  const { designId } = useParams<{ designId: string }>();

  const {
    data: selectedDesign,
    isLoading,
    error,
  } = useGetDesignByIdQuery(Number(designId));

  const handleBackToList = () => {
    navigate(-1);
  };

  const { showErrorAlert, errorMessages, setShowErrorAlert } = useErrorAlert({
    "Error obteniendo el diseño.": error,
  });

  return (
    <>
      <div className="container mx-auto px-4">
        <Button
          outline
          onClick={handleBackToList}
          className="my-4 flex items-center text-rymel-blue hover:text-blue-800 transition-colors"
        >
          <span className="mr-2">←</span>
          Volver al catálogo
        </Button>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full">
            <Skeleton count={10} className="mb-4" />
          </div>
        ) : (
          selectedDesign && (
            <DesignViewer
              handleBackToList={handleBackToList}
              design={selectedDesign}
            />
          )
        )}
      </div>
      {showErrorAlert && (
        <Alert
          messages={errorMessages}
          error
          onClose={() => setShowErrorAlert(false)}
        />
      )}
    </>
  );
};

export default DesignDetailsPage;
