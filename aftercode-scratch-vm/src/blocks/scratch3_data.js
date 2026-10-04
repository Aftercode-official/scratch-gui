const Cast = require('../util/cast');

class Scratch3DataBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            data_variable: this.getVariable,
            data_setvariableto: this.setVariableTo,
            data_changevariableby: this.changeVariableBy,
            data_hidevariable: this.hideVariable,
            data_showvariable: this.showVariable,
            data_listcontents: this.getListContents,
            data_addtolist: this.addToList,
            data_deleteoflist: this.deleteOfList,
            data_deletealloflist: this.deleteAllOfList,
            data_insertatlist: this.insertAtList,
            data_replaceitemoflist: this.replaceItemOfList,
            data_itemoflist: this.getItemOfList,
            data_itemnumoflist: this.getItemNumOfList,
            data_lengthoflist: this.lengthOfList,
            data_listcontainsitem: this.listContainsItem,
            data_listasarray: this.listAsArray,
            data_setlistarray: this.setListArray,
            data_hidelist: this.hideList,
            data_showlist: this.showList,
            data_tablecontents: this.getTableContents,
            data_addtotable: this.addToTable,
            data_insertdimensiontotable: this.insertDimensionToTable,
            data_setcellintable: this.setCellInTable,
            data_deletecellintable: this.deleteCellInTable,
            data_deletedimensionintable: this.deleteDimensionInTable,
            data_deletealloftable: this.deleteAllOfTable,
            data_itemincelloftable: this.itemInCellOfTable,
            data_itemsofdimensionoftable: this.itemsOfDimensionOfTable,
            data_lengthofdimensionoftable: this.lengthOfDimensionOfTable,
            data_dimensioncountoftable: this.dimensionCountOfTable,
            data_tablecontainsitemincell: this.tableContainsItemInCell,
            data_tableasarray: this.tableAsArray,
            data_settableusingarray: this.setTableUsingArray,
            data_showtable: this.showTable,
            data_hidetable: this.hideTable
        };
    }

    getVariable (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);
        return variable.value;
    }

    setVariableTo (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);
        variable.value = args.VALUE;

        if (variable.isCloud) {
            util.ioQuery('cloud', 'requestUpdateVariable', [variable.name, args.VALUE]);
        }
    }

    changeVariableBy (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);
        const castedValue = Cast.toNumber(variable.value);
        const dValue = Cast.toNumber(args.VALUE);
        const newValue = castedValue + dValue;
        variable.value = newValue;

        if (variable.isCloud) {
            util.ioQuery('cloud', 'requestUpdateVariable', [variable.name, newValue]);
        }
    }

    changeMonitorVisibility (id, visible) {
        // Send the monitor blocks an event like the flyout checkbox event.
        // This both updates the monitor state and changes the isMonitored block flag.
        this.runtime.monitorBlocks.changeBlock({
            id: id, // Monitor blocks for variables are the variable ID.
            element: 'checkbox', // Mimic checkbox event from flyout.
            value: visible
        }, this.runtime);
    }

    showVariable (args) {
        this.changeMonitorVisibility(args.VARIABLE.id, true);
    }

    hideVariable (args) {
        this.changeMonitorVisibility(args.VARIABLE.id, false);
    }

    showList (args) {
        this.changeMonitorVisibility(args.LIST.id, true);
    }

    hideList (args) {
        this.changeMonitorVisibility(args.LIST.id, false);
    }

    getListContents (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);

        // If block is running for monitors, return copy of list as an array if changed.
        if (util.thread.updateMonitor) {
            // Return original list value if up-to-date, which doesn't trigger monitor update.
            if (list._monitorUpToDate) return list.value;
            // If value changed, reset the flag and return a copy to trigger monitor update.
            // MonitorState only detects updates when the object changes.
            list._monitorUpToDate = true;
            return list.value.slice();
        }

        // Determine if the list is all single letters.
        // If it is, report contents joined together with no separator.
        // If it's not, report contents joined together with a space.
        let allSingleLetters = true;
        for (let i = 0; i < list.value.length; i++) {
            const listItem = list.value[i];
            if (!((typeof listItem === 'string') &&
                  (listItem.length === 1))) {
                allSingleLetters = false;
                break;
            }
        }
        if (allSingleLetters) {
            return list.value.join('');
        }
        return list.value.map(item => Cast.toString(item)).join(' ');
    }

    addToList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        list.value.push(args.ITEM);
        list._monitorUpToDate = false;
    }

    deleteOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length, true);
        if (index === Cast.LIST_INVALID) {
            return;
        } else if (index === Cast.LIST_ALL) {
            list.value = [];
            return;
        }
        list.value.splice(index - 1, 1);
        list._monitorUpToDate = false;
    }

    deleteAllOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        list.value = [];
        return;
    }

    insertAtList (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length + 1, false);
        if (index === Cast.LIST_INVALID) {
            return;
        }
        list.value.splice(index - 1, 0, item);
        list._monitorUpToDate = false;
    }

    replaceItemOfList (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length, false);
        if (index === Cast.LIST_INVALID) {
            return;
        }
        list.value[index - 1] = item;
        list._monitorUpToDate = false;
    }

    getItemOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        const index = Cast.toListIndex(args.INDEX, list.value.length, false);
        if (index === Cast.LIST_INVALID) {
            return '';
        }
        return list.value[index - 1];
    }

    getItemNumOfList (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);

        // Go through the list items one-by-one using Cast.compare. This is for
        // cases like checking if 123 is contained in a list [4, 7, '123'] --
        // Scratch considers 123 and '123' to be equal.
        for (let i = 0; i < list.value.length; i++) {
            if (Cast.compare(list.value[i], item) === 0) {
                return i + 1;
            }
        }

        // We don't bother using .indexOf() at all, because it would end up with
        // edge cases such as the index of '123' in [4, 7, 123, '123', 9].
        // If we use indexOf(), this block would return 4 instead of 3, because
        // indexOf() sees the first occurence of the string 123 as the fourth
        // item in the list. With Scratch, this would be confusing -- after all,
        // '123' and 123 look the same, so one would expect the block to say
        // that the first occurrence of '123' (or 123) to be the third item.

        // Default to 0 if there's no match. Since Scratch lists are 1-indexed,
        // we don't have to worry about this conflicting with the "this item is
        // the first value" number (in JS that is 0, but in Scratch it's 1).
        return 0;
    }

    lengthOfList (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        return list.value.length;
    }

    listContainsItem (args, util) {
        const item = args.ITEM;
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        if (list.value.indexOf(item) >= 0) {
            return true;
        }
        // Try using Scratch comparison operator on each item.
        // (Scratch considers the string '123' equal to the number 123).
        for (let i = 0; i < list.value.length; i++) {
            if (Cast.compare(list.value[i], item) === 0) {
                return true;
            }
        }
        return false;
    }

    listAsArray (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        return Cast.toArray(list.value);
    }

    setListArray (args, util) {
        const list = util.target.lookupOrCreateList(
            args.LIST.id, args.LIST.name);
        list.value = Cast.toArray(args.ARRAY);
        list._monitorUpToDate = false;
    }

    getTableContents (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);

        // If block is running for monitors, return copy of list as an array if changed.
        if (util.thread.updateMonitor) {
            // Return original list value if up-to-date, which doesn't trigger monitor update.
            if (table._monitorUpToDate) return table.value;
            // If value changed, reset the flag and return a copy to trigger monitor update.
            // Because monitors use Immutable data structures, only new objects trigger updates.
            table._monitorUpToDate = true;
            return table.value.map(row => {
                if (Array.isArray(row)) {
                    return row.slice();
                }
                return row;
            });
        }

        // Flatten the table to a string representation
        // Each row is joined with spaces, rows are separated by newlines
        return table.value.map(row => {
            if (Array.isArray(row)) {
                return row.map(cell => Cast.toString(cell)).join(' ');
            }
            return Cast.toString(row);
        }).join('\n');
    }

    addToTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        if (args.DIMENSION === 'column') {
            if (table.value.length === 0) {
                table.value.push(['']);
            } else {
                for (let i = 0; i < table.value.length; i++) {
                    if (Array.isArray(table.value[i])) {
                        table.value[i].push('');
                    }
                }
            }
        } else if (args.DIMENSION === 'row') {
            const columnCount = table.value.length > 0 && Array.isArray(table.value[0]) ?
                table.value[0].length :
                1;
            const newRow = Array(columnCount).fill('');
            table.value.push(newRow);
        }
        table._monitorUpToDate = false;
    }

    insertDimensionToTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        let index;
        if (args.DIMENSION === 'column') {
            const columnCount = Cast.getTableColumnCount(table.value);
            index = Cast.toListIndex(args.INDEX, columnCount + 1, false);
        } else {
            const rowCount = Cast.getTableRowCount(table.value);
            index = Cast.toListIndex(args.INDEX, rowCount + 1, false);
        }
        if (index === Cast.LIST_INVALID) {
            return;
        }
        if (args.DIMENSION === 'column') {
            if (table.value.length === 0) {
                table.value.push(['']);
            } else {
                for (let i = 0; i < table.value.length; i++) {
                    if (Array.isArray(table.value[i])) {
                        table.value[i].splice(index - 1, 0, '');
                    }
                }
            }
        } else if (args.DIMENSION === 'row') {
            const columnCount = Cast.getTableColumnCount(table.value);
            const newRow = Array(columnCount || 1).fill('');
            table.value.splice(index - 1, 0, newRow);
        }
        table._monitorUpToDate = false;
    }

    setCellInTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        const rowIndex = Cast.toTableRowIndex(args.ROW, table.value, false);
        const columnIndex = Cast.toTableColumnIndex(args.COLUMN, table.value, false);
        if (rowIndex === Cast.LIST_INVALID || columnIndex === Cast.LIST_INVALID) {
            return;
        }
        if (table.value[rowIndex - 1] && Array.isArray(table.value[rowIndex - 1])) {
            table.value[rowIndex - 1][columnIndex - 1] = args.ITEM;
            table._monitorUpToDate = false;
        }
    }

    deleteCellInTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        const rowIndex = Cast.toTableRowIndex(args.ROW, table.value, false);
        const columnIndex = Cast.toTableColumnIndex(args.COLUMN, table.value, false);
        if (rowIndex === Cast.LIST_INVALID || columnIndex === Cast.LIST_INVALID) {
            return;
        }
        if (table.value[rowIndex - 1] && Array.isArray(table.value[rowIndex - 1])) {
            table.value[rowIndex - 1][columnIndex - 1] = '';
            table._monitorUpToDate = false;
        }
    }

    deleteDimensionInTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        let index;
        if (args.DIMENSION === 'column') {
            index = Cast.toTableColumnIndex(args.INDEX, table.value, false);
        } else {
            index = Cast.toTableRowIndex(args.INDEX, table.value, false);
        }
        if (index === Cast.LIST_INVALID) {
            return;
        }
        if (args.DIMENSION === 'column') {
            for (let i = 0; i < table.value.length; i++) {
                if (Array.isArray(table.value[i])) {
                    table.value[i].splice(index - 1, 1);
                }
            }
            if (Cast.getTableColumnCount(table.value) === 0) {
                table.value = [];
            }
        } else if (args.DIMENSION === 'row') {
            table.value.splice(index - 1, 1);
        }
        table._monitorUpToDate = false;
    }

    deleteAllOfTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        table.value = [];
        table._monitorUpToDate = false;
    }

    itemInCellOfTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        const rowIndex = Cast.toTableRowIndex(args.ROW, table.value, false);
        const columnIndex = Cast.toTableColumnIndex(args.COLUMN, table.value, false);
        if (rowIndex === Cast.LIST_INVALID || columnIndex === Cast.LIST_INVALID) {
            return '';
        }
        if (table.value[rowIndex - 1] && Array.isArray(table.value[rowIndex - 1])) {
            return table.value[rowIndex - 1][columnIndex - 1] || '';
        }
        return '';
    }

    itemsOfDimensionOfTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        if (args.DIMENSION === 'column') {
            const columnIndex = Cast.toTableColumnIndex(args.INDEX, table.value, false);
            if (columnIndex === Cast.LIST_INVALID) {
                return [];
            }
            const column = [];
            for (let i = 0; i < table.value.length; i++) {
                if (Array.isArray(table.value[i])) {
                    column.push(table.value[i][columnIndex - 1] || '');
                }
            }
            return column;
        }
        const rowIndex = Cast.toTableRowIndex(args.INDEX, table.value, false);
        if (rowIndex === Cast.LIST_INVALID) {
            return [];
        }
        if (table.value[rowIndex - 1] && Array.isArray(table.value[rowIndex - 1])) {
            return table.value[rowIndex - 1].slice();
        }
        return [];
    }

    lengthOfDimensionOfTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        if (args.DIMENSION === 'column') {
            const columnIndex = Cast.toTableColumnIndex(args.INDEX, table.value, false);
            if (columnIndex === Cast.LIST_INVALID) {
                return 0;
            }
            return table.value.length;
        }
        const rowIndex = Cast.toTableRowIndex(args.INDEX, table.value, false);
        if (rowIndex === Cast.LIST_INVALID) {
            return 0;
        }
        if (table.value[rowIndex - 1] && Array.isArray(table.value[rowIndex - 1])) {
            return table.value[rowIndex - 1].length;
        }
        return 0;
    }

    dimensionCountOfTable (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        if (args.DIMENSION === 'column') {
            return Cast.getTableColumnCount(table.value);
        }
        return Cast.getTableRowCount(table.value);
    }

    tableContainsItemInCell (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        const item = args.ITEM;
        const rowIndex = Cast.toTableRowIndex(args.ROW, table.value, false);
        const columnIndex = Cast.toTableColumnIndex(args.COLUMN, table.value, false);
        if (rowIndex === Cast.LIST_INVALID || columnIndex === Cast.LIST_INVALID) {
            return false;
        }
        if (table.value[rowIndex - 1] && Array.isArray(table.value[rowIndex - 1])) {
            const cellValue = table.value[rowIndex - 1][columnIndex - 1];
            return Cast.compare(cellValue, item) === 0;
        }
        return false;
    }

    tableAsArray (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        return table.value.map(row => {
            if (Array.isArray(row)) {
                return row.slice();
            }
            return row;
        });
    }

    setTableUsingArray (args, util) {
        const table = util.target.lookupOrCreateTable(
            args.TABLE.id, args.TABLE.name);
        const arr = Cast.toArray(args.ARR);
        table.value = arr.map(item => {
            if (Array.isArray(item)) {
                return item.slice();
            }
            return [item];
        });
        table._monitorUpToDate = false;
    }

    showTable (args) {
        this.changeMonitorVisibility(args.TABLE.id, true);
    }

    hideTable (args) {
        this.changeMonitorVisibility(args.TABLE.id, false);
    }
}

module.exports = Scratch3DataBlocks;
