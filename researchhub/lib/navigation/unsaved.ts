export type UnsavedGuard={label:string;dirty:()=>boolean;busy:()=>boolean;save:()=>Promise<boolean>;discard?:()=>void};
// Populated by browser effects only, never by server requests.
const guards=new Set<UnsavedGuard>();
export function registerUnsavedGuard(guard:UnsavedGuard){guards.add(guard);return()=>{guards.delete(guard);};}
export function pendingGuards(){return [...guards].filter(guard=>guard.dirty()||guard.busy());}
export function requestWorkspaceNavigation(action:()=>void){
 const event=new CustomEvent("scholar-request-navigation",{cancelable:true,detail:{action}});
 if(window.dispatchEvent(event))action();
}
