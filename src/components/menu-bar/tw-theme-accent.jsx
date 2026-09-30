import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {connect} from 'react-redux';

import check from './check.svg';
import dropdownCaret from './dropdown-caret.svg';
import {MenuItem, Submenu} from '../menu/menu.jsx';
import {
    ACCENT_BLUE,
    ACCENT_CUSTOM,
    ACCENT_MAP,
    ACCENT_PURPLE,
    ACCENT_RAINBOW,
    ACCENT_RED,
    ACCENT_YELLOW,
    Theme
} from '../../lib/themes/index.js';
import {openAccentMenu, accentMenuOpen, closeSettingsMenu} from '../../reducers/menus.js';
import {setTheme} from '../../reducers/theme.js';
import {persistTheme} from '../../lib/themes/themePersistance.js';
import rainbowIcon from './tw-accent-rainbow.svg';
import styles from './settings-menu.css';

const options = defineMessages({
    [ACCENT_RED]: {
        defaultMessage: 'Red',
        description: 'Name of the red color scheme, used by TurboWarp by default.',
        id: 'tw.accent.red'
    },
    [ACCENT_PURPLE]: {
        defaultMessage: 'Purple',
        description: 'Name of the purple color scheme. Matches modern Scratch.',
        id: 'tw.accent.purple'
    },
    [ACCENT_BLUE]: {
        defaultMessage: 'Blue',
        description: 'Name of the blue color scheme. Matches Scratch before the high contrast update.',
        id: 'tw.accent.blue'
    },
    [ACCENT_RAINBOW]: {
        defaultMessage: 'Rainbow',
        description: 'Name of color scheme that uses a rainbow.',
        id: 'tw.accent.rainbow'
    },
    [ACCENT_YELLOW]: {
        defaultMessage: 'Yellow',
        description: 'Name of the yellow color scheme.',
        id: 'tw.accent.yellow'
    },
    [ACCENT_CUSTOM]: {
        defaultMessage: 'Custom',
        description: 'Name of the user-selected custom accent color.',
        id: 'tw.accent.custom'
    }
});

const icons = {
    [ACCENT_RAINBOW]: rainbowIcon
};

const ColorIcon = props => (
    props.id === ACCENT_CUSTOM ? (
        <div
            className={styles.accentIconOuter}
            style={{backgroundColor: props.customAccent.guiColors['looks-secondary']}}
        />
    ) : icons[props.id] ? (
        <img
            className={styles.accentIconOuter}
            src={icons[props.id]}
            draggable={false}
            // Image is decorative
            alt=""
        />
    ) : (
        <div
            className={styles.accentIconOuter}
            style={{
                // menu-bar-background is var(...), don't want to evaluate with the current values
                backgroundColor: ACCENT_MAP[props.id].guiColors['looks-secondary'],
                backgroundImage: ACCENT_MAP[props.id].guiColors['menu-bar-background-image']
            }}
        />
    )
);

ColorIcon.propTypes = {
    customAccent: PropTypes.shape({
        guiColors: PropTypes.object.isRequired
    }),
    id: PropTypes.string
};

const AccentMenuItem = props => (
    <MenuItem onClick={props.onClick}>
        <div className={styles.option}>
            <img
                className={classNames(styles.check, {[styles.selected]: props.isSelected})}
                width={15}
                height={12}
                src={check}
                draggable={false}
            />
            <ColorIcon
                customAccent={props.customAccent}
                id={props.id}
            />
            <FormattedMessage {...options[props.id]} />
        </div>
    </MenuItem>
);

AccentMenuItem.propTypes = {
    customAccent: PropTypes.shape({
        guiColors: PropTypes.object.isRequired
    }),
    id: PropTypes.string,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func
};

const AccentThemeMenu = ({
    customAccent,
    isOpen,
    isRtl,
    onChangeTheme,
    onOpen,
    theme
}) => (
    <MenuItem expanded={isOpen}>
        <div
            className={styles.option}
            onClick={onOpen}
        >
            <ColorIcon
                customAccent={customAccent}
                id={theme.accent}
            />
            <span className={styles.submenuLabel}>
                <FormattedMessage
                    defaultMessage="Accent"
                    description="Label for menu to choose accent color (eg. TurboWarp's red, Scratch's purple)"
                    id="tw.menuBar.accent"
                />
            </span>
            <img
                className={styles.expandCaret}
                src={dropdownCaret}
                draggable={false}
            />
        </div>
        <Submenu place={isRtl ? 'left' : 'right'}>
            {[
                ACCENT_RED,
                ACCENT_PURPLE,
                ACCENT_BLUE,
                ACCENT_RAINBOW,
                ACCENT_YELLOW,
                ...(customAccent ? [ACCENT_CUSTOM] : [])
            ].map(item => (
                <AccentMenuItem
                    key={item}
                    customAccent={customAccent}
                    id={item}
                    isSelected={theme.accent === item}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => onChangeTheme(
                        item === ACCENT_CUSTOM ?
                            theme.set('accent', customAccent) :
                            theme.set('accent', item)
                    )}
                />
            ))}
        </Submenu>
    </MenuItem>
);

AccentThemeMenu.propTypes = {
    customAccent: PropTypes.shape({
        guiColors: PropTypes.object.isRequired
    }),
    isOpen: PropTypes.bool,
    isRtl: PropTypes.bool,
    onChangeTheme: PropTypes.func,
    onOpen: PropTypes.func,
    theme: PropTypes.instanceOf(Theme)
};

const mapStateToProps = state => ({
    customAccent: state.scratchGui.theme.theme.customAccent,
    isOpen: accentMenuOpen(state),
    isRtl: state.locales.isRtl,
    theme: state.scratchGui.theme.theme
});

const mapDispatchToProps = dispatch => ({
    onChangeTheme: theme => {
        dispatch(setTheme(theme));
        dispatch(closeSettingsMenu());
        persistTheme(theme);
    },
    onOpen: () => dispatch(openAccentMenu())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AccentThemeMenu);
