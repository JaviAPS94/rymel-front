import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Fa1 } from "react-icons/fa6";
import { MdOutlineDesignServices } from "react-icons/md";
import { CiBoxList } from "react-icons/ci";
import { IoMdAdd } from "react-icons/io";
import { FaEye } from "react-icons/fa";

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesignDropdownOpen, setIsDesignDropdownOpen] = useState(false);
  const [isMobileDesignDropdownOpen, setIsMobileDesignDropdownOpen] =
    useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const { hasRole, user, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDesignDropdownOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsUserDropdownOpen(false);
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

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
                {hasRole("ADMIN", "NORM") && (
                  <Link
                    to="/"
                    className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold flex items-center"
                  >
                    <CiBoxList className="text-white h-8 w-8 mr-1" />
                    Normas
                  </Link>
                )}

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() =>
                      setIsDesignDropdownOpen(!isDesignDropdownOpen)
                    }
                    className="text-gray-100 hover:bg-rymel-yellow hover:text-white px-3 py-2 rounded-md text-lg font-bold flex items-center"
                  >
                    <MdOutlineDesignServices className="text-white h-8 w-8 mr-1" />
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
                      <div className="p-1">
                        <Link
                          to="/design"
                          className="flex items-center rounded-md bg-rymel-yellow p-2 text-sm text-white font-semibold hover:bg-rymel-blue"
                          onClick={() => setIsDesignDropdownOpen(false)}
                        >
                          <IoMdAdd className="text-white h-4 w-4 mr-1" />
                          Agregar diseño
                        </Link>
                        <Link
                          to="/design/list"
                          className="flex items-center rounded-md bg-rymel-yellow p-2 text-sm text-white font-semibold hover:bg-rymel-blue"
                          onClick={() => setIsDesignDropdownOpen(false)}
                        >
                          <FaEye className="text-white h-4 w-4 mr-1" />
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

          {/* User dropdown - Desktop */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
              >
                <div className="h-10 w-10 rounded-full bg-rymel-yellow flex items-center justify-center text-white font-bold">
                  {user?.email ? getInitials(user.email) : "U"}
                </div>
              </button>
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-rymel-yellow rounded-md shadow-lg z-50">
                  <div className="p-1">
                    <div className="px-4 py-3 border-b border-rymel-blue">
                      <p className="text-sm font-semibold text-white">
                        {user?.email}
                      </p>
                      <p className="text-xs text-gray-200 mt-1">
                        {user?.roles.join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="rounded-md mt-1 block w-full h-full font-semibold text-left px-4 py-2 text-sm text-white hover:bg-rymel-blue"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
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

            {/* User section - Mobile */}
            <div className="border-t border-gray-700 pt-4 mt-4">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-gray-300">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {user?.roles.join(", ")}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-300 hover:bg-gray-700 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
