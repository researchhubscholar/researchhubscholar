/** Never replace an explicit unavailable project with another permitted project. */
export function selectedProject<T extends {id:string}>(projects:T[], requested?:string|null):T|undefined {
  return requested != null ? projects.find(project=>project.id===requested) : undefined;
}
