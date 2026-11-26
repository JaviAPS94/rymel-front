import { useNavigate, useParams } from "react-router-dom";
import DesignViewer from "../components/design/DesignViewer";
import { useGetDesignByIdQuery } from "../store";
import { useErrorAlert } from "../hooks/useAlertError";
import Alert from "../components/core/Alert";
import { PageHeader, Page } from "@rymel/ui";

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
      {isLoading || !selectedDesign ? (
        <>
          <PageHeader
            back={{ label: "Volver al catálogo", onClick: handleBackToList }}
            title={isLoading ? "Cargando…" : "Diseño no disponible"}
          />
          <Page>
            <div className="h-40 animate-pulse rounded-[20px] border bg-white" />
          </Page>
        </>
      ) : (
        <DesignViewer
          handleBackToList={handleBackToList}
          design={selectedDesign}
        />
      )}
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
