import { ReactNode, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultActiveTab?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

const Tabs = ({
  items,
  defaultActiveTab,
  className = "",
  onTabChange,
}: TabsProps) => {
  const [activeTab, setActiveTab] = useState(
    defaultActiveTab || items[0]?.id || ""
  );

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex border-b border-gray-200">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={`px-4 py-2 font-medium text-sm transition-colors duration-200 border-b-2 flex items-center gap-2 ${
              activeTab === item.id
                ? "border-rymel-blue bg-rymel-blue text-white rounded-t-md"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {item.icon && <span>{item.icon}</span>}
            <span className="font-bold">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="p-4">
        {items.map((item) => (
          <div
            key={item.id}
            style={{ display: activeTab === item.id ? "block" : "none" }}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
