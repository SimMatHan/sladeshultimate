import { createContext, useContext } from "react";

const CheckInContext = createContext(null);

export function useCheckInGate() {
  const context = useContext(CheckInContext);
  if (!context) {
    throw new Error("useCheckInGate must be used within a CheckInContext provider");
  }
  return context;
}

export default CheckInContext;

