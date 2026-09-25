import type {Metadata} from "next";
import {MaterialCalculator} from "./material-calculator";

export const metadata:Metadata={
  title:"Tính vật tư xây nhà | Tipook",
  description:"Tính bê tông, xây tường, trát, lát gạch và sơn nước."
};

export default function Page(){
  return <main className="social-shell mx-auto max-w-[1360px] px-3 py-5 sm:px-4 lg:px-5">
    <MaterialCalculator/>
  </main>
}