import { useState } from "react";
import CardList from "../components/core/CardList";
import { useNavigate } from "react-router-dom";
import { useGetNormsPaginatedQuery } from "../store/apis/normApi";
import Select, { Option } from "../components/core/Select";
import { useGetCountriesQuery } from "../store";
import NoData from "../components/core/NoData";
import CustomInput from "../components/core/CustomInput";
import Pagination from "../components/core/Pagination";
import Button from "../components/core/Button";
import { FaPlus } from "react-icons/fa";

const NormListPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [name, setName] = useState<string>("");
  const [country, setCountry] = useState<number>();

  const { data, error, isLoading } = useGetNormsPaginatedQuery({
    page,
    limit,
    name: name || undefined,
    country: country || undefined,
  });

  const { data: countries, isLoading: isLoadingCountries } =
    useGetCountriesQuery(null);

  if (isLoadingCountries) {
    return <div>Loading countries...</div>;
  }
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error loading data</p>;

  const handleAddNormClick = () => {
    navigate("/norms/new");
  };

  const handleCountryChange = (countryId: number | undefined) => {
    setCountry(countryId);
  };

  return (
    <>
      <div
        className={`max-w-full bg-white rounded-lg shadow-lg overflow-hidden pb-5 my-10 mx-10 ${
          !data?.data || data.data.length === 0 ? "min-h-screen" : ""
        }`}
      >
        <div className="bg-rymel-blue text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Listado de normas</h1>
              <p className="text-white mt-1">
                {data?.total} normas disponibles
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                className="h-12"
                primary
                onClick={handleAddNormClick}
                icon={<FaPlus />}
              >
                Añadir norma
              </Button>
              <div className="bg-rymel-yellow px-4 py-2 rounded-lg">
                <span className="text-2xl font-bold">{data?.data.length}</span>
                <span className="text-white ml-2">filtradas</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-gray-200">
          <div className="flex justify-center min-w-[26rem] mb-5">
            <CustomInput
              type="text"
              value={name}
              onChange={setName}
              placeholder="Buscar por nombre"
              className="mt-4"
            />
            <Select
              className="ml-4"
              options={countries?.map(
                (country) =>
                  ({
                    label: country.name,
                    value: country.id,
                  } as Option<number>)
              )}
              selectedValue={country}
              onChange={handleCountryChange}
              isLoading={false}
              placeholder="Selecciona un país"
              errorKey="country"
            />
          </div>
        </div>

        {data?.data.length === 0 ? (
          <div className="justify-center items-center flex py-12">
            <NoData
              className="w-1/2 bg-gray-400"
              message="No hay resultados para mostrar."
            />
          </div>
        ) : (
          <div className="mt-6">
            <CardList items={data?.data} />
          </div>
        )}

        {data && data.data.length > 0 && (
          <div className="flex justify-center align-middle mx-auto mt-4 text-2xl space-x-2">
            <Pagination
              currentPage={page}
              totalPages={data.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default NormListPage;
