/**
 * Data Processing Utilities for Sherlock Search
 */

/**
 * Setup columns for main result datatable
 * @param {Array} configColumns 
 * @param {Object} configData 
 * @returns {Array} Enriched columns
 */
export function setupColumns(configColumns, configData) {
    let enrichedColumns = JSON.parse(JSON.stringify(configColumns));

    enrichedColumns = enrichedColumns.map(col => {
        // Self-healing: if type is missing, try to find it in searchFields
        if (!col.type && !col.sfdcType && configData && configData.searchFields) {
            const matchingSearchField = configData.searchFields.find(f => f.fieldName === col.fieldName);
            if (matchingSearchField && matchingSearchField.type) {
                col.type = matchingSearchField.type;
            }
        }

        const rawType = (col.sfdcType || col.type || '').toUpperCase();
        col.type = 'text';

        if (rawType === 'BOOLEAN') col.type = 'boolean';
        else if (rawType === 'DATE' || rawType === 'DATETIME') col.type = 'date'; 
        else if (['NUMBER', 'DOUBLE', 'INTEGER', 'LONG', 'DECIMAL'].includes(rawType)) col.type = 'number';
        else if (rawType === 'CURRENCY') col.type = 'currency';
        else if (rawType === 'PERCENT') col.type = 'percent';
        else if (rawType === 'EMAIL') col.type = 'email';
        else if (rawType === 'PHONE') col.type = 'phone';
        else if (rawType === 'URL') col.type = 'url';

        if (col.fieldName && !col.fieldName.includes('.')) {
            if (col.fieldName.toLowerCase() !== 'id') {
                col.editable = true;
            }
        }

        if (!col.initialWidth) {
            if (col.type === 'number' || col.type === 'boolean') col.initialWidth = 100;
            else if (col.type === 'date' || col.type === 'percent') col.initialWidth = 150;
            else if (col.type === 'currency') col.initialWidth = 160;
            else if (col.type === 'email' || col.type === 'phone') col.initialWidth = 200;
            else if (col.type === 'url') col.initialWidth = 250;
            else col.initialWidth = 180;
        }
        return col;
    });

    enrichedColumns.unshift({
        type: 'button-icon',
        initialWidth: 50,
        typeAttributes: {
            iconName: 'utility:record_alt',
            name: 'view_details',
            variant: 'bare',
            alternativeText: '詳細を開く',
            title: '詳細を開く'
        }
    });

    if (configData && configData.childObjectApiName && configData.childRelationshipField) {
        enrichedColumns.splice(1, 0, {
            type: 'button-icon',
            initialWidth: 50,
            typeAttributes: {
                iconName: 'utility:hierarchy',
                name: 'drilldown',
                variant: 'bare',
                alternativeText: '関連レコードを表示',
                title: '関連レコードを表示'
            }
        });
    }

    enrichedColumns.push({
        type: 'action',
        typeAttributes: { rowActions: [{ label: '編集', name: 'edit' }, { label: '削除', name: 'delete' }] }
    });

    return enrichedColumns;
}

/**
 * Setup columns for child drilldown datatable
 */
export function setupChildColumns(configChildFields) {
    let childCols = JSON.parse(JSON.stringify(configChildFields));
    childCols = childCols.map(col => {
        const rawType = (col.type || '').toUpperCase();
        col.type = 'text';

        if (rawType === 'BOOLEAN') col.type = 'boolean';
        else if (rawType === 'DATE' || rawType === 'DATETIME') col.type = 'date'; 
        else if (['NUMBER', 'DOUBLE', 'INTEGER', 'LONG', 'DECIMAL'].includes(rawType)) col.type = 'number';
        else if (rawType === 'CURRENCY') col.type = 'currency';
        else if (rawType === 'PERCENT') col.type = 'percent';
        else if (rawType === 'EMAIL') col.type = 'email';
        else if (rawType === 'PHONE') col.type = 'phone';
        else if (rawType === 'URL') col.type = 'url';
        
        if (!col.initialWidth) {
            if (col.type === 'number' || col.type === 'boolean') col.initialWidth = 100;
            else if (col.type === 'date' || col.type === 'percent') col.initialWidth = 150;
            else if (col.type === 'currency') col.initialWidth = 160;
            else if (col.type === 'email' || col.type === 'phone') col.initialWidth = 200;
            else if (col.type === 'url') col.initialWidth = 250;
            else col.initialWidth = 180;
        }
        return col;
    });

    childCols.unshift({
        type: 'button-icon',
        initialWidth: 50,
        typeAttributes: {
            iconName: 'utility:record_alt',
            name: 'view_details',
            variant: 'bare',
            alternativeText: '詳細を開く',
            title: '詳細を開く'
        }
    });
    
    childCols.push({
        type: 'action',
        typeAttributes: { rowActions: [{ label: '編集', name: 'edit' }, { label: '削除', name: 'delete' }] }
    });

    return childCols;
}

/**
 * Flattens nested object structures and generates tile metadata
 */
export function flattenData(dataArray, columns) {
    if (!dataArray || !Array.isArray(dataArray)) return [];

    return dataArray.map(record => {
        let result = {};
        
        const recurse = (current, propertySource) => {
            if (Object(current) !== current) {
                result[propertySource] = current;
            } else if (Array.isArray(current)) {
                result[propertySource] = current.join(', ');
            } else {
                let isEmpty = true;
                for (let p in current) {
                    isEmpty = false;
                    recurse(current[p], propertySource ? propertySource + '.' + p : p);
                }
                if (isEmpty && propertySource) {
                    result[propertySource] = {};
                }
            }
        };
        
        recurse(record, '');
        
        const displayColumns = columns.filter(col => col.type !== 'action' && col.fieldName);
        result._tileHeader = displayColumns.length > 0 ? (result[displayColumns[0].fieldName] || record.Id) : record.Id;
        result._tileFields = displayColumns.map(col => ({
            label: col.label,
            value: result[col.fieldName] || ''
        }));

        return result;
    });
}

/**
 * Generates and triggers CSV download
 */
export function generateAndDownloadCSV(data, columns, targetObject, exportFileName) {
    const exportColumns = columns ? columns.filter(col => col.fieldName) : [];
    if (exportColumns.length === 0) return false;

    const headers = exportColumns.map(col => col.label || col.fieldName);
    const columnFields = exportColumns.map(col => col.fieldName);

    const csvRows = [headers.join(',')];

    data.forEach(row => {
        const values = columnFields.map(field => {
            let val = row[field];
            if (val === undefined || val === null) val = '';
            val = String(val).replace(/"/g, '""');
            return val.includes(',') ? `"${val}"` : val;
        });
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\r\n');
    const BOM = '\uFEFF';
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(BOM + csvString);
        link.setAttribute('href', encodedUri);
        
        let fileName = exportFileName ? `${exportFileName}.csv` : `Export_${targetObject || 'Records'}_${new Date().getTime()}.csv`;
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    }
    return false;
}
