public with sharing class SherlockQueryBuilder {
    
    // DTO Definition
    public class SearchRequest {
        @AuraEnabled public String targetObject { get; set; }
        @AuraEnabled public List<String> selectFields { get; set; }
        @AuraEnabled public String keywordTerm { get; set; }
        @AuraEnabled public List<FilterCriteria> soqlFilters { get; set; }
        @AuraEnabled public String customLogic { get; set; }
        @AuraEnabled public String hiddenFilter { get; set; }
        @AuraEnabled public List<SortCriterion> sortCriteria { get; set; }
        @AuraEnabled public Integer recordLimit { get; set; }
        @AuraEnabled public Integer recordOffset { get; set; }
    }

    public class SortCriterion {
        @AuraEnabled public String fieldName { get; set; }
        @AuraEnabled public String direction { get; set; }
    }

    public class FilterCriteria {
        @AuraEnabled public Integer conditionIndex { get; set; }
        @AuraEnabled public String fieldName { get; set; }
        @AuraEnabled public String operator { get; set; }
        @AuraEnabled public String value { get; set; }
    }

    // Main build method used to construct the query and variables
    public static QueryContext buildQuery(SearchRequest request) {
        QueryContext ctx = new QueryContext();
        ctx.bindMap = new Map<String, Object>();
        
        List<String> conditions = new List<String>();
        Integer bindIndex = 1;

        // 1. Base Select Clause
        String selectClause = 'SELECT Id';
        if (request.selectFields != null && !request.selectFields.isEmpty()) {
            Set<String> fieldSet = new Set<String>();
            for(String field : request.selectFields) {
                if(field.toLowerCase() != 'id') {
                    fieldSet.add(field);
                }
            }
            if(!fieldSet.isEmpty()){
                selectClause += ', ' + String.join(new List<String>(fieldSet), ', ');
            }
        }
        
        String fromClause = ' FROM ' + String.escapeSingleQuotes(request.targetObject);
        
        // --- 1.5 Get Object Metadata for typed binding ---
        SObjectType objType = Schema.getGlobalDescribe().get(request.targetObject);
        Map<String, Schema.SObjectField> fieldMap = (objType != null) ? objType.getDescribe().fields.getMap() : new Map<String, Schema.SObjectField>();

        // 2. Handle Keyword Search (Dynamic SOQL for text fields and picklists)
        if (String.isNotBlank(request.keywordTerm)) {
            if (objType != null) {
                List<String> textOrConditions = new List<String>();
                
                String termVar = 'term_' + bindIndex;
                ctx.bindMap.put(termVar, '%' + request.keywordTerm + '%');
                bindIndex++;
                
                for (String fieldName : fieldMap.keySet()) {
                    Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
                    // Basic Check
                    if (!fieldDescribe.isAccessible() || !fieldDescribe.isFilterable()) {
                        continue;
                    }
                    
                    Schema.DisplayType dType = fieldDescribe.getType();
                    String fName = fieldDescribe.getName();
                    
                    if (dType == Schema.DisplayType.String || dType == Schema.DisplayType.TextArea || 
                        dType == Schema.DisplayType.Email || dType == Schema.DisplayType.Phone || 
                        dType == Schema.DisplayType.URL) {
                        
                        textOrConditions.add(fName + ' LIKE :' + termVar);
                        
                    } else if (dType == Schema.DisplayType.Picklist) {
                        List<String> matchingValues = new List<String>();
                        for(Schema.PicklistEntry pe : fieldDescribe.getPicklistValues()) {
                            if (pe.isActive()) {
                                String label = pe.getLabel();
                                String val = pe.getValue();
                                if ((label != null && label.containsIgnoreCase(request.keywordTerm)) || 
                                    (val != null && val.containsIgnoreCase(request.keywordTerm))) {
                                    matchingValues.add(val);
                                }
                            }
                        }
                        if (!matchingValues.isEmpty()) {
                            String plVar = 'pl_' + bindIndex;
                            ctx.bindMap.put(plVar, matchingValues);
                            textOrConditions.add(fName + ' IN :' + plVar);
                            bindIndex++;
                        }
                    }
                }
                
                if (!textOrConditions.isEmpty()) {
                    conditions.add('(' + String.join(textOrConditions, ' OR ') + ')');
                } else {
                    conditions.add('(Id = null)'); 
                }
            }
        }

        // 3. Handle specific SOQL Filters with Type Casting
        Map<Integer, String> conditionMap = new Map<Integer, String>();
        if (request.soqlFilters != null && !request.soqlFilters.isEmpty()) {
            for (FilterCriteria fc : request.soqlFilters) {
                if (String.isBlank(fc.fieldName) || fc.value == null || fc.conditionIndex == null) continue;

                String bindVar = 'var_' + bindIndex;
                String op = String.escapeSingleQuotes(fc.operator); 
                String fieldName = String.escapeSingleQuotes(fc.fieldName);
                Schema.SObjectField fld = fieldMap.get(fc.fieldName.toLowerCase());
                
                Object castValue = fc.value; // Default to string

                if (fld != null) {
                    Schema.DescribeFieldResult dr = fld.getDescribe();
                    Schema.DisplayType dt = dr.getType();

                    if (op.equalsIgnoreCase('RANGE')) {
                        try {
                            Map<String, Object> rangeVals = (Map<String, Object>)JSON.deserializeUntyped(fc.value);
                            String minStr = rangeVals.containsKey('min') ? String.valueOf(rangeVals.get('min')) : null;
                            String maxStr = rangeVals.containsKey('max') ? String.valueOf(rangeVals.get('max')) : null;
                            
                            List<String> rangeConditions = new List<String>();
                            
                            if (String.isNotBlank(minStr)) {
                                Object castMin = castValue(dt, minStr, dr.getLabel());
                                String minBindVar = bindVar + '_min';
                                ctx.bindMap.put(minBindVar, castMin);
                                rangeConditions.add(fieldName + ' >= :' + minBindVar);
                            }
                            
                            if (String.isNotBlank(maxStr)) {
                                Object castMax = castValue(dt, maxStr, dr.getLabel());
                                String maxBindVar = bindVar + '_max';
                                ctx.bindMap.put(maxBindVar, castMax);
                                rangeConditions.add(fieldName + ' <= :' + maxBindVar);
                            }
                            
                            if (!rangeConditions.isEmpty()) {
                                conditionMap.put(fc.conditionIndex, '(' + String.join(rangeConditions, ' AND ') + ')');
                            }
                        } catch (Exception e) {
                            String msg = 'フィールド「' + dr.getLabel() + '」の範囲指定の形式が正しくありません: ' + fc.value;
                            AuraHandledException ahe = new AuraHandledException(msg);
                            ahe.setMessage(msg);
                            throw ahe;
                        }
                    } else {
                        Object typedValue = castValue(dt, fc.value, dr.getLabel());
                        if (op.equalsIgnoreCase('LIKE')) {
                            ctx.bindMap.put(bindVar, '%' + String.valueOf(typedValue) + '%');
                        } else {
                            ctx.bindMap.put(bindVar, typedValue);
                        }
                        conditionMap.put(fc.conditionIndex, fieldName + ' ' + op + ' :' + bindVar);
                    }
                } else {
                    // String default
                    if (op.equalsIgnoreCase('LIKE')) {
                        ctx.bindMap.put(bindVar, '%' + fc.value + '%');
                    } else if (!op.equalsIgnoreCase('RANGE')) {
                        ctx.bindMap.put(bindVar, fc.value);
                    }
                    if (!op.equalsIgnoreCase('RANGE')) {
                        conditionMap.put(fc.conditionIndex, fieldName + ' ' + op + ' :' + bindVar);
                    }
                }
                
                bindIndex++;
            }
        }

        // 4. Combine Filters with Custom Logic
        if (!conditionMap.isEmpty()) {
            if (String.isNotBlank(request.customLogic)) {
                String resolvedLogic = request.customLogic;
                for (Integer idx : conditionMap.keySet()) {
                    // Use Matcher.quoteReplacement to handle SOQL special characters in regex replacement
                    String replacement = Matcher.quoteReplacement(conditionMap.get(idx));
                    resolvedLogic = resolvedLogic.replaceAll('\\b' + String.valueOf(idx) + '\\b', replacement);
                }
                
                // Final cleanup: Replace any remaining indices (numbers) that were not filled with (Id != NULL)
                // This prevents SOQL errors when a user specifies logic like "1 AND 2" but leaves field 2 empty.
                resolvedLogic = resolvedLogic.replaceAll('\\b\\d+\\b', '(Id != NULL)');
                
                conditions.add('(' + resolvedLogic + ')');
            } else {
                conditions.add('(' + String.join(conditionMap.values(), ' AND ') + ')');
            }
        }

        // 5. Add Hidden FIlter (System admin enforced)
        if (String.isNotBlank(request.hiddenFilter)) {
            // we trust hiddenFilter up to a point, but might require bind parsing ideally
            conditions.add('(' + request.hiddenFilter + ')');
        }

        // 6. Build the WHERE clause
        String whereClause = '';
        if (!conditions.isEmpty()) {
            whereClause = ' WHERE ' + String.join(conditions, ' AND ');
        }
        
        // 6.5 Order By
        String orderClause = '';
        if (request.sortCriteria != null && !request.sortCriteria.isEmpty()) {
            List<String> orderParts = new List<String>();
            for (SortCriterion sc : request.sortCriteria) {
                if (String.isNotBlank(sc.fieldName)) {
                    String direction = (String.isNotBlank(sc.direction) && sc.direction.toUpperCase() == 'DESC') ? 'DESC' : 'ASC';
                    orderParts.add(String.escapeSingleQuotes(sc.fieldName) + ' ' + direction + ' NULLS LAST');
                }
            }
            if (!orderParts.isEmpty()) {
                orderClause = ' ORDER BY ' + String.join(orderParts, ', ');
            }
        }
        
        // 7. Pagination
        String tailClause = '';
        if (request.recordLimit != null && request.recordLimit > 0) {
            tailClause += ' LIMIT ' + request.recordLimit;
        } else {
            tailClause += ' LIMIT 50'; // Default safety limit
        }
        
        if (request.recordOffset != null && request.recordOffset > 0) {
            tailClause += ' OFFSET ' + request.recordOffset;
        }

        ctx.queryString = selectClause + fromClause + whereClause + orderClause + tailClause;
        return ctx;
    }

    public class QueryContext {
        public String queryString { get; set; }
        public Map<String, Object> bindMap { get; set; }
    }

    private static Object castValue(Schema.DisplayType dt, String stringValue, String fieldLabel) {
        if (String.isBlank(stringValue)) return null;
        Object castValue = stringValue;
        try {
            if (dt == Schema.DisplayType.Boolean) {
                castValue = Boolean.valueOf(stringValue);
            } else if (dt == Schema.DisplayType.Integer) {
                castValue = Integer.valueOf(stringValue);
            } else if (dt == Schema.DisplayType.Double || dt == Schema.DisplayType.Currency || dt == Schema.DisplayType.Percent) {
                castValue = Double.valueOf(stringValue);
            } else if (dt == Schema.DisplayType.Date) {
                castValue = Date.valueOf(stringValue);
            } else if (dt == Schema.DisplayType.DateTime) {
                castValue = (Object)JSON.deserialize('"' + stringValue + '"', DateTime.class);
            } else if (dt == Schema.DisplayType.Time) {
                String[] timeParts = stringValue.split(':');
                if (timeParts.size() >= 2) {
                    Integer hours = Integer.valueOf(timeParts[0]);
                    Integer minutes = Integer.valueOf(timeParts[1]);
                    Integer seconds = 0;
                    Integer milliseconds = 0;
                    if (timeParts.size() >= 3) {
                        String secPart = timeParts[2];
                        if (secPart.contains('.')) {
                            String[] sParts = secPart.split('\\.');
                            seconds = Integer.valueOf(sParts[0]);
                            milliseconds = Integer.valueOf(sParts[1]);
                        } else {
                            seconds = Integer.valueOf(secPart);
                        }
                    }
                    castValue = Time.newInstance(hours, minutes, seconds, milliseconds);
                }
            }
        } catch (Exception e) {
            String msg = 'フィールド「' + fieldLabel + '」に無効な値が指定されました: ' + stringValue;
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
        return castValue;
    }
}