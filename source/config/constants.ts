//=============================================================================
// Permissions
interface PermissionLevel {
    name:string;
    value:number;
}
type PermissionLevelLookup = {[name:string]:PermissionLevel};

const permission_level:Array<PermissionLevel> = [
    { name:"user"    , value:1 },
    { name:"sub"     , value:2 },
    { name:"mod"     , value:4 },
    { name:"streamer", value:8 },
];
permission_level.push({ name:"all", value:(permission_level[permission_level.length-1].value << 1) - 1 });

const permission_level_lookup:PermissionLevelLookup = {};
for(let index:number=0; index<permission_level.length; ++index) {
    const perm = permission_level[index];
    permission_level_lookup[perm.name] = perm;
}

//=============================================================================
// Constants
interface Constants {
    log_debug:boolean;
    log_error:boolean;
    permissions:PermissionLevelLookup;
}

const constants:Constants = {
    log_error: true,
    log_debug: true,
    permissions: permission_level_lookup,
};

export default constants;
