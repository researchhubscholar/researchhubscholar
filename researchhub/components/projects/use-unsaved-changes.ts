"use client";
import {useEffect,useRef} from "react";
import {registerUnsavedGuard} from "@/lib/navigation/unsaved";
export function useUnsavedChanges({label,dirty,busy,onSave,onDiscard}:{label:string;dirty:boolean;busy:boolean;onSave:()=>Promise<boolean>;onDiscard?:()=>void}){
 const latest=useRef({dirty,busy,onSave,onDiscard});latest.current={dirty,busy,onSave,onDiscard};
 useEffect(()=>registerUnsavedGuard({label,dirty:()=>latest.current.dirty,busy:()=>latest.current.busy,save:()=>latest.current.onSave(),discard:()=>latest.current.onDiscard?.()}),[label]);
}
