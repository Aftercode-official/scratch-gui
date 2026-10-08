const getScratchProjectIdFromUrl = projectUrl => {
    let url;
    try {
        url = new URL(projectUrl);
    } catch (e) {
        return null;
    }

    if (url.hostname !== 'scratch.mit.edu' && url.hostname !== 'www.scratch.mit.edu') {
        return null;
    }

    const match = /^\/projects\/(\d+)(?:\/|$)/.exec(url.pathname);
    return match ? match[1] : null;
};

export {
    getScratchProjectIdFromUrl
};
