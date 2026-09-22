import { createContext } from "react";

export const AppContext = createContext();

const DataProvider = ({ children }) => {
  // Netlify Functions on the same site (netlify/functions). In development
  // the Vite dev server proxies these same paths straight to EduPage.
  const API_URL = "/.netlify/functions";

  return (
    <AppContext.Provider value={{ API_URL }}>
      {children}
    </AppContext.Provider>
  );
};

export default DataProvider;
