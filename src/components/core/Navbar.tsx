import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesignDropdownOpen, setIsDesignDropdownOpen] = useState(false);
  const [isMobileDesignDropdownOpen, setIsMobileDesignDropdownOpen] =
    useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDesignDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav className="bg-rymel-blue">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            {/* Mobile menu button */}
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded={isOpen}
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16m-7 6h7"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
            <div className="flex-shrink-0">
              <img
                className="h-12 w-auto"
                src="https://rymel.com.co/wp-content/uploads/2024/07/Logo-Rymel-Oscuro.png"
              />
            </div>
            <div className="hidden sm:block sm:w-full sm:ml-6">
              <div className="flex justify-center items-center space-x-10 h-full">
                <Link
                  to="/"
                  className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold"
                >
                  Normas
                </Link>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() =>
                      setIsDesignDropdownOpen(!isDesignDropdownOpen)
                    }
                    className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold flex items-center"
                  >
                    Diseño
                    <svg
                      className={`ml-1 h-4 w-4 transition-transform ${
                        isDesignDropdownOpen ? "rotate-180" : ""
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {isDesignDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-rymel-yellow rounded-md shadow-lg z-50">
                      <div className="py-1">
                        <Link
                          to="/design"
                          className="block bg-rymel-yellow px-4 py-2 text-sm text-white font-semibold hover:bg-rymel-blue"
                          onClick={() => setIsDesignDropdownOpen(false)}
                        >
                          Agregar diseño
                        </Link>
                        <Link
                          to="/design/list"
                          className="block bg-rymel-yellow px-4 py-2 text-sm text-white font-semibold hover:bg-rymel-blue"
                          onClick={() => setIsDesignDropdownOpen(false)}
                        >
                          Ver diseños
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                <a
                  href="#"
                  className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold"
                >
                  Módulo 3
                </a>
                <a
                  href="#"
                  className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold"
                >
                  Módulo 4
                </a>
                <a
                  href="#"
                  className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold"
                >
                  Módulo 5
                </a>
                <a
                  href="#"
                  className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold"
                >
                  Módulo 6
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="sm:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
            >
              Normas
            </Link>
            <div>
              <button
                onClick={() =>
                  setIsMobileDesignDropdownOpen(!isMobileDesignDropdownOpen)
                }
                className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-base font-medium w-full text-left flex items-center justify-between"
              >
                Diseño
                <svg
                  className={`h-4 w-4 transition-transform ${
                    isMobileDesignDropdownOpen ? "rotate-180" : ""
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isMobileDesignDropdownOpen && (
                <div className="pl-6 space-y-1">
                  <Link
                    to="/design"
                    className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-sm font-medium"
                    onClick={() => setIsMobileDesignDropdownOpen(false)}
                  >
                    Diseño Principal
                  </Link>
                  <Link
                    to="/elements-design"
                    className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-sm font-medium"
                    onClick={() => setIsMobileDesignDropdownOpen(false)}
                  >
                    Diseño de Elementos
                  </Link>
                </div>
              )}
            </div>
            <a
              href="#"
              className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
            >
              Módulo 3
            </a>
            <a
              href="#"
              className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
            >
              Módulo 4
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
