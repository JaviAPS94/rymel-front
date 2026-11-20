import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TbPlus, TbSearch } from "react-icons/tb";
import { useGetNormsPaginatedQuery } from "../store/apis/normApi";
import { useGetCountriesQuery } from "../store";
import Select, { Option } from "../components/core/Select";
import CustomInput from "../components/core/CustomInput";
import Button from "../components/core/Button";
import NormTable from "../components/norms/NormTable";
import { PageHeader, Pagination, EmptyState, Page } from "@rymel/ui";

const PAGE_SIZE = 10;

const NormListPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const [name, setName] = useState<string>("");
  const [country, setCountry] = useState<number>();

  const { data, error, isLoading } = useGetNormsPaginatedQuery({
    page,
    limit: PAGE_SIZE,
    name: name || undefined,
    country: country || undefined,
  });

  const { data: countries, isLoading: isLoadingCountries } =
    useGetCountriesQuery(null);

  // Cambiar un filtro vuelve a la primera página: la actual puede no existir
  // en el resultado nuevo.
  const handleNameChange = (value: string) => {
    setName(value);
    setPage(1);
  };

  const handleCountryChange = (countryId: number | undefined) => {
    setCountry(countryId);
    setPage(1);
  };

  const clearFilters = () => {
    setName("");
    setCountry(undefined);
    setPage(1);
  };

  const hasFilters = Boolean(name || country);

  return (
    <>
      <PageHeader
        eyebrow="Catálogo técnico"
        title="Normas"
        description={
          data ? (
            <>
              <strong>
                {data.total} {data.total === 1 ? "norma" : "normas"}
              </strong>
              {hasFilters ? " con estos filtros." : " registradas."}
            </>
          ) : (
            "Las normas sobre las que se calculan los diseños."
          )
        }
        actions={
          <Button
            variant="light"
            size="lg"
            className="!h-[52px] !rounded-[14px] !px-6 !text-base"
            onClick={() => navigate("/norms/new")}
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-rymel-yellow">
              <TbPlus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            Nueva norma
          </Button>
        }
      />

      <Page>
        <form
          role="search"
          aria-label="Filtrar normas"
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-wrap items-center gap-3 rounded-[20px] border bg-white p-5"
        >
          <CustomInput
            type="search"
            aria-label="Buscar por nombre"
            size="lg"
            className="min-w-0 flex-[999_1_360px]"
            value={name}
            onChange={handleNameChange}
            placeholder="Buscar por nombre…"
            leftIcon={<TbSearch className="h-[18px] w-[18px] text-gray-400" />}
          />
          <div className="min-w-0 flex-[1_1_240px]">
            <Select
              options={countries?.map(
                (country) =>
                  ({
                    label: country.name,
                    value: country.id,
                  }) as Option<number>,
              )}
              selectedValue={country}
              onChange={handleCountryChange}
              isLoading={isLoadingCountries}
              placeholder="Todos los países"
              errorKey="country"
              size="lg"
            />
          </div>
        </form>

        {isLoading ? (
          <p className="text-sm text-gray-600">Cargando…</p>
        ) : error ? (
          <EmptyState tone="error" title="No se pudieron cargar las normas." />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            title={
              hasFilters
                ? "Ninguna norma coincide con los filtros."
                : "Todavía no hay normas."
            }
            action={
              hasFilters && (
                <Button base onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        ) : (
          <NormTable
            items={data.data}
            footer={
              <Pagination
                page={page}
                totalPages={data.totalPages}
                onPageChange={setPage}
                totalItems={data.total}
                pageSize={PAGE_SIZE}
              />
            }
          />
        )}
      </Page>
    </>
  );
};

export default NormListPage;
