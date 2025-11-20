"use client";

import DesignList from "../components/design/DesignList";
import { Design } from "../commons/types";
import { useNavigate } from "react-router-dom";

const DesignsListPage = () => {
  const navigate = useNavigate();

  const handleSelectDesign = (design: Design) => {
    navigate(`/design/${design.id}/details`);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <DesignList onSelectDesign={handleSelectDesign} />
      </div>
    </main>
  );
};

export default DesignsListPage;
