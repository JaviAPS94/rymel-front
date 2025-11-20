import { useEffect, useRef, useState } from "react";
import NormForm from "../components/norms/NormForm";
import {
  useGetCountriesQuery,
  useGetNormByIdQuery,
  useGetSpecificationsQuery,
  useGetTypesWithFieldsQuery,
} from "../store";
import NormInformation from "../components/norms/NormInformation";
import Alert from "../components/core/Alert";
import { useGetElementsByFiltersQuery } from "../store/apis/elementApi";
import { NormProvider } from "../context/NormProvider";
import { FileUploadHandle } from "../components/core/FileUpload";
import { useParams } from "react-router-dom";
import { CompleteElementData, NormCompleteData } from "../commons/types";
import { urlToFile } from "../commons/functions";
import { BiEdit } from "react-icons/bi";
import { IoMdAdd } from "react-icons/io";

export interface ElementValue {
  name: string;
  value: string | File | object | object[] | number | unknown;
  type: string;
  key: string;
  sapReference: boolean;
  validations: Record<string, unknown>;
  descriptionInfo: string;
}

export interface NormElement {
  id?: number | undefined;
  values: ElementValue[];
  subType?: number;
  subTypeName?: string;
  type?: number | undefined;
  subTypeCode?: string | undefined;
  specialItem?: number;
  sapReference: string;
}

export interface NormData {
  id?: number | undefined;
  name: string | undefined;
  version: string;
  country: number | undefined;
  normFile: File | null;
  elements: NormElement[];
}

const NormPage = () => {
  const { normId } = useParams<{ normId: string }>();
  const isEditing = !!normId;

  const [formData, setFormData] = useState<NormData>({
    id: normId ? Number(normId) : undefined,
    name: "",
    version: "",
    country: undefined,
    normFile: null,
    elements: [],
  });

  const { data: existingNorm, isLoading: isLoadingNorm } = useGetNormByIdQuery(
    Number(normId),
    {
      skip: !isEditing,
    }
  );

  // Create a ref to access FirstComponent's function
  const fileUploadRef = useRef<FileUploadHandle | null>(null);

  // Function to be called from SecondComponent
  const handleReset = () => {
    // Call the clearFile method from the parent component
    if (fileUploadRef.current) {
      fileUploadRef.current.clearFile();
    }
  };

  const {
    data: countries,
    error: errorCountries,
    isLoading: isLoadingCountries,
  } = useGetCountriesQuery(null);

  const {
    data: specifications,
    error: errorSpecifications,
    isLoading: isLoadingSpecifications,
  } = useGetSpecificationsQuery(null);

  const {
    data: types,
    error: errorTypes,
    isLoading: isLoadingTypes,
  } = useGetTypesWithFieldsQuery(null);

  const {
    data: elementsByFilters,
    error: errorElementsByFilters,
    isLoading: isLoadingElementsByFilters,
  } = useGetElementsByFiltersQuery({
    country: formData.country || 0,
    name: formData.name,
  });

  const [showErrorAlert, setShowErrorAlert] = useState(false);

  const mapNormCompleteDataToNormData = async (
    norm: NormCompleteData
  ): Promise<NormData> => {
    return {
      id: norm.id,
      name: norm.name,
      version: norm.version,
      normFile: await urlToFile(
        norm.normFile ? `http://localhost:3000/${norm.normFile}` : ""
      ),
      country: norm.country?.id, // Assuming `country` has an `id` property
      elements: norm.elements.map(mapCompleteElementDataToNormElement),
    };
  };

  const mapCompleteElementDataToNormElement = (
    element: CompleteElementData
  ): NormElement => {
    return {
      id: element.id,
      values: element.values.map(mapRecordToElementValue),
      subType: element.subType?.id,
      subTypeCode: element.subType?.code,
      subTypeName: element.subType?.name,
      type: element.subType?.type.id,
      sapReference: element.sapReference,
    };
  };

  const mapRecordToElementValue = (
    record: Record<string, unknown>
  ): ElementValue => {
    return {
      name: (record.name as string) || "", // Ensure it is a string
      value: record.value ?? "", // Default to empty string if null/undefined
      type: (record.type as string) || "",
      key: (record.key as string) || "",
      sapReference: Boolean(record.sapReference),
      validations: (record.validations as Record<string, unknown>) || {},
      descriptionInfo: (record.descriptionInfo as string) || "",
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      if (existingNorm) {
        const mappedData = await mapNormCompleteDataToNormData(existingNorm);
        setFormData(mappedData);
      }
    };

    fetchData();
  }, [existingNorm]);

  useEffect(() => {
    if (
      errorCountries ||
      errorTypes ||
      errorElementsByFilters ||
      errorSpecifications
    ) {
      setShowErrorAlert(true);
      setTimeout(() => setShowErrorAlert(false), 3000);
    }
  }, [errorCountries, errorTypes, errorElementsByFilters, errorSpecifications]);

  const handleFileSelect = (file: File | null) => {
    setFormData({ ...formData, normFile: file });
  };

  if (isLoadingCountries) {
    return <div>Loading countries...</div>;
  }

  if (isLoadingTypes) {
    return <div>Loading types...</div>;
  }

  if (isLoadingElementsByFilters) {
    return <div>Loading elements by filters...</div>;
  }

  if (isLoadingSpecifications) {
    return <div>Loading specifications...</div>;
  }

  if (isLoadingNorm) {
    return <div>Loading norm...</div>;
  }

  return (
    <NormProvider>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-4 mx-10">
        <div className="bg-rymel-blue text-white p-6">
          <h1 className="font-bold text-3xl text-center flex items-center justify-center gap-2">
            {isEditing ? (
              <BiEdit className="text-white h-8 w-8" />
            ) : (
              <IoMdAdd className="text-white h-8 w-8" />
            )}
            {isEditing ? "Editar Norma" : "Generar Nueva Norma"}
          </h1>
        </div>

        <div className="mx-10">
          <div className="flex h-screen">
            <div className="w-4/6 p-8 overflow-auto">
              <NormForm
                countries={countries}
                types={types}
                formData={formData}
                setFormData={setFormData}
                elementsByFilters={elementsByFilters}
                specifications={specifications}
                handleFileSelect={handleFileSelect}
                fileUploadRef={fileUploadRef}
              />
            </div>
            <div className="w-2/6 p-8 bg-white overflow-auto">
              <NormInformation
                formData={formData}
                setFormData={setFormData}
                handleReset={handleReset}
                isEditing={isEditing}
              />
            </div>
          </div>
        </div>
        {showErrorAlert && (
          <Alert message="Ha ocurrido un error al cargar los datos" error />
        )}
      </div>
    </NormProvider>
  );
};

export default NormPage;
