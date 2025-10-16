"use client";

import { useState } from "react";
import DesignViewer from "../components/design/DesignViewer";
import DesignList from "../components/design/DesignList";
import { Design } from "../commons/types";

export default function Home() {
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);

  const handleSelectDesign = (design: Design) => {
    setSelectedDesign(design);
  };

  const handleBackToList = () => {
    setSelectedDesign(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {selectedDesign ? (
          <div>
            <button
              onClick={handleBackToList}
              className="mb-6 flex items-center text-rymel-blue hover:text-blue-800 transition-colors"
            >
              <span className="mr-2">←</span>
              Volver al catálogo
            </button>
            <DesignViewer design={selectedDesign} />
          </div>
        ) : (
          <DesignList onSelectDesign={handleSelectDesign} />
        )}
      </div>
    </main>
  );
}
