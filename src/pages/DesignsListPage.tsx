"use client";

import DesignList from "../components/design/DesignList";
import { Design } from "../commons/types";
import { useNavigate } from "react-router-dom";

const DesignsListPage = () => {
  const navigate = useNavigate();

  const handleSelectDesign = (design: Design) => {
    navigate(`/design/${design.id}/details`);
  };

  return <DesignList onSelectDesign={handleSelectDesign} />;
};

export default DesignsListPage;
