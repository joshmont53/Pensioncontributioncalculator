import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import Home from "./app/Home.tsx";
import App from "./app/App.tsx";
import Admin from "./app/Admin.tsx";
import { CalculatorProvider } from "./app/context/CalculatorContext.tsx";
import "./styles/index.css";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/calculator", element: <App /> },
  { path: "/admin", element: <Admin /> },
]);

createRoot(document.getElementById("root")!).render(
  <CalculatorProvider>
    <RouterProvider router={router} />
  </CalculatorProvider>
);
