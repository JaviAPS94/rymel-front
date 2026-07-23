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
      <div className="inline-flex items-center gap-1 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
              activeTab === item.id
                ? "bg-rymel-blue text-white shadow-md"
                : "text-slate-500 hover:text-rymel-blue hover:bg-white"
            }`}
          >
            {item.icon && (
              <span className="text-base leading-none">{item.icon}</span>
            )}
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-4 border-t border-slate-100 mt-3">
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
