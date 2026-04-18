@IsTest
private class SherlockQueryBuilderTest {

    @IsTest
    static void testBuildQuery_Keywords() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.selectFields = new List<String>{'Name', 'Phone'};
        req.keywordTerm = 'SearchToken';
        
        Test.startTest();
        SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(req);
        Test.stopTest();
        
        Assert.isNotNull(ctx.queryString, 'Query string should be generated');
        Assert.isTrue(ctx.queryString.contains('SELECT Id, Name, Phone FROM Account'), 'Base query mismatch');
        Assert.isTrue(ctx.queryString.contains('LIKE :term_1'), 'Keyword binding missing');
        Assert.isTrue(ctx.bindMap.containsKey('term_1'), 'Binding map missing keyword');
        Assert.areEqual('%SearchToken%', ctx.bindMap.get('term_1'));
    }

    @IsTest
    static void testBuildQuery_Filters() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.soqlFilters = new List<SherlockQueryBuilder.FilterCriteria>();
        
        SherlockQueryBuilder.FilterCriteria f1 = new SherlockQueryBuilder.FilterCriteria();
        f1.conditionIndex = 1;
        f1.fieldName = 'Name';
        f1.operator = '=';
        f1.value = 'TargetAccount';
        req.soqlFilters.add(f1);

        SherlockQueryBuilder.FilterCriteria f2 = new SherlockQueryBuilder.FilterCriteria();
        f2.conditionIndex = 2;
        f2.fieldName = 'NumberOfEmployees';
        f2.operator = '>';
        f2.value = '100';
        req.soqlFilters.add(f2);
        
        Test.startTest();
        SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(req);
        Test.stopTest();
        
        Assert.isTrue(ctx.queryString.contains('Name = :var_1'), 'Filter 1 missing');
        Assert.isTrue(ctx.queryString.contains('NumberOfEmployees > :var_2'), 'Filter 2 missing');
        Assert.areEqual('TargetAccount', ctx.bindMap.get('var_1'));
        Assert.areEqual(100, ctx.bindMap.get('var_2'));
    }

    @IsTest
    static void testBuildQuery_Range() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.soqlFilters = new List<SherlockQueryBuilder.FilterCriteria>();
        
        SherlockQueryBuilder.FilterCriteria f1 = new SherlockQueryBuilder.FilterCriteria();
        f1.conditionIndex = 1;
        f1.fieldName = 'AnnualRevenue';
        f1.operator = 'RANGE';
        f1.value = '{"min": 1000, "max": 5000}';
        req.soqlFilters.add(f1);
        
        Test.startTest();
        SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(req);
        Test.stopTest();
        
        Assert.isTrue(ctx.queryString.contains('AnnualRevenue >= :var_1_min'), 'Range min missing');
        Assert.isTrue(ctx.queryString.contains('AnnualRevenue <= :var_1_max'), 'Range max missing');
        Assert.areEqual(1000.0, ctx.bindMap.get('var_1_min'));
        Assert.areEqual(5000.0, ctx.bindMap.get('var_1_max'));
    }

    @IsTest
    static void testBuildQuery_CustomLogic() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.customLogic = '1 AND 2';
        req.soqlFilters = new List<SherlockQueryBuilder.FilterCriteria>();
        
        SherlockQueryBuilder.FilterCriteria f1 = new SherlockQueryBuilder.FilterCriteria();
        f1.conditionIndex = 1;
        f1.fieldName = 'Name';
        f1.operator = '=';
        f1.value = 'Val1';
        req.soqlFilters.add(f1);

        SherlockQueryBuilder.FilterCriteria f2 = new SherlockQueryBuilder.FilterCriteria();
        f2.conditionIndex = 2;
        f2.fieldName = 'Phone';
        f2.operator = '=';
        f2.value = 'Val2';
        req.soqlFilters.add(f2);
        
        Test.startTest();
        SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(req);
        Test.stopTest();
        
        Assert.isTrue(ctx.queryString.contains('(Name = :var_1 AND Phone = :var_2)'), 'Custom logic resolution failed');
    }

    @IsTest
    static void testBuildQuery_Types() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.soqlFilters = new List<SherlockQueryBuilder.FilterCriteria>();
        
        // Date
        SherlockQueryBuilder.FilterCriteria f1 = new SherlockQueryBuilder.FilterCriteria();
        f1.conditionIndex = 1;
        f1.fieldName = 'LastActivityDate';
        f1.operator = '=';
        f1.value = '2024-01-01';
        req.soqlFilters.add(f1);

        // Boolean
        SherlockQueryBuilder.FilterCriteria f2 = new SherlockQueryBuilder.FilterCriteria();
        f2.conditionIndex = 2;
        f2.fieldName = 'IsDeleted'; // Not filterable usually but just for cast test logic simulation
        f2.operator = '=';
        f2.value = 'true';
        req.soqlFilters.add(f2);

        Test.startTest();
        SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(req);
        Test.stopTest();
        
        Assert.areEqual(Date.valueOf('2024-01-01'), ctx.bindMap.get('var_1'));
        Assert.areEqual(true, ctx.bindMap.get('var_2'));
    }

    @IsTest
    static void testBuildQuery_SortLimit() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.sortCriteria = new List<SherlockQueryBuilder.SortCriterion>();
        SherlockQueryBuilder.SortCriterion sc = new SherlockQueryBuilder.SortCriterion();
        sc.fieldName = 'Name';
        sc.direction = 'DESC';
        req.sortCriteria.add(sc);
        req.recordLimit = 10;
        req.recordOffset = 5;
        
        Test.startTest();
        SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(req);
        Test.stopTest();
        
        Assert.isTrue(ctx.queryString.contains('ORDER BY Name DESC NULLS LAST'), 'Order by mismatch');
        Assert.isTrue(ctx.queryString.contains('LIMIT 10'), 'Limit missing');
        Assert.isTrue(ctx.queryString.contains('OFFSET 5'), 'Offset missing');
    }

    @IsTest
    static void testErrorHandling_InvalidType() {
        SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
        req.targetObject = 'Account';
        req.soqlFilters = new List<SherlockQueryBuilder.FilterCriteria>();
        
        SherlockQueryBuilder.FilterCriteria f1 = new SherlockQueryBuilder.FilterCriteria();
        f1.conditionIndex = 1;
        f1.fieldName = 'NumberOfEmployees';
        f1.operator = '=';
        f1.value = 'NotANumber';
        req.soqlFilters.add(f1);
        
        try {
            Test.startTest();
            SherlockQueryBuilder.buildQuery(req);
            Test.stopTest();
            Assert.fail('Should have thrown an exception');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('無効な値'), 'Error message mismatch');
        }
    }
}
