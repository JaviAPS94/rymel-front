import type React from "react";
import CheckboxListItem from "./CheckboxListItem";
import { useMemo, useState } from "react";
import { BiCheck, BiMinus } from "react-icons/bi";
import Pagination from "./Pagination";

interface CheckboxListProps<T> {
  items: T[];
  selectedItems: unknown[];
  toggleItem: (id: unknown) => void;
  labelFieldKey: keyof T;
  additionalFieldKey: keyof T;
  multipleItems: boolean;
  childrenKey?: keyof T;
  selectAll?: (ids: unknown[]) => void;
  title?: string;
  itemsPerPage?: number;
  enablePagination?: boolean;
}

const CheckboxList = <T extends { id: unknown; [key: string]: unknown }>({
  items,
  selectedItems,
  toggleItem,
  labelFieldKey,
  additionalFieldKey,
  multipleItems,
  childrenKey,
  selectAll,
  title,
  itemsPerPage = 10,
  enablePagination = false,
}: CheckboxListProps<T>): React.ReactElement => {
  const [currentPage, setCurrentPage] = useState(1);

  const getAllIds = (items: T[]): unknown[] => {
    let ids: unknown[] = [];

    items.forEach((item) => {
      ids.push(item.id);

      if (
        childrenKey &&
        Array.isArray(item[childrenKey]) &&
        (item[childrenKey] as T[]).length > 0
      ) {
        ids = [...ids, ...getAllIds(item[childrenKey] as T[])];
      }
    });

    return ids;
  };

  const allIds = useMemo(() => getAllIds(items), [items, childrenKey]);

  // Pagination logic
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    if (!enablePagination) return items;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage, enablePagination]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedItems.includes(id));
  const someSelected =
    allIds.some((id) => selectedItems.includes(id)) && !allSelected;

  const handleSelectAll = () => {
    if (selectAll) {
      if (allSelected) {
        selectAll([]);
      } else {
        selectAll(allIds);
      }
    }
  };

  const renderItem = (item: T) => {
    const hasChildren =
      childrenKey &&
      Array.isArray(item[childrenKey]) &&
      (item[childrenKey] as T[]).length > 0;

    return (
      <CheckboxListItem
        key={item.id as string}
        id={item.id}
        label={item[labelFieldKey] as string}
        additionalInfo={item[additionalFieldKey] as string}
        isChecked={selectedItems.includes(item.id)}
        onToggle={toggleItem}
        isDisabled={
          !multipleItems &&
          selectedItems.length >= 1 &&
          !selectedItems.includes(item.id)
        }
      >
        {hasChildren && (
          <CheckboxList
            items={item[childrenKey] as T[]}
            selectedItems={selectedItems}
            toggleItem={toggleItem}
            labelFieldKey={labelFieldKey}
            additionalFieldKey={additionalFieldKey}
            multipleItems={multipleItems}
            childrenKey={childrenKey}
          />
        )}
      </CheckboxListItem>
    );
  };

  return (
    <div className="checkbox-list">
      {(title || selectAll) && (
        <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
          {selectAll && (
            <div
              className="flex items-center cursor-pointer mr-2"
              onClick={handleSelectAll}
              role="checkbox"
              aria-checked={allSelected}
              tabIndex={0}
            >
              <div className="w-5 h-5 border border-gray-300 rounded flex items-center justify-center mr-2 bg-white">
                {allSelected && <BiCheck size={20} className="text-blue-500" />}
                {someSelected && (
                  <BiMinus size={20} className="text-blue-500" />
                )}
              </div>
              <span className="text-sm font-medium">
                Seleccionar todos {title}
              </span>
            </div>
          )}
        </div>
      )}
      <ul className="divide-y divide-gray-300 space-y-3 min-h-10">
        {paginatedItems.map(renderItem)}
      </ul>
      {enablePagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

export default CheckboxList;
