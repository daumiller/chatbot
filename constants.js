let constants = {
    PERMISSION_STRING_LOOKUP: {},
};

//=============================================================================
// Permissions Constants
let permissions = [
    { name:"PERMISSION_USER"    , integer:1, string:"user"     },
    { name:"PERMISSION_SUB"     , integer:2, string:"sub"      },
    { name:"PERMISSION_MOD"     , integer:4, string:"mod"      },
    { name:"PERMISSION_STREAMER", integer:8, string:"streamer" },
];

for(let index=0; index<permissions.length; ++index) {
    const perm = permissions[index];
    constants[perm.name]             = perm.integer;
    constants[`${perm.name}_STRING`] = perm.string;
    constants.PERMISSION_STRING_LOOKUP[perm.string] = perm.integer;
}

constants.PERMISSION_MAX = (permissions[permissions.length-1].integer << 1) - 1;

module.exports = constants;
