const SET_PROJECT_ASSETS = 'scratch-gui/project-assets/SET_PROJECT_ASSETS';

const projectAssetsInitialState = [];

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = projectAssetsInitialState;
    switch (action.type) {
    case SET_PROJECT_ASSETS:
        return action.assets;
    default:
        return state;
    }
};

const setProjectAssets = assets => ({
    type: SET_PROJECT_ASSETS,
    assets
});

export {
    reducer as default,
    projectAssetsInitialState,
    setProjectAssets
};
