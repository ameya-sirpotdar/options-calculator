
window.common = (function () {
    var common = {};

    common.getFragment = function getFragment() {
        if (window.location.hash.indexOf("#") === 0) {
            return parseQueryString(window.location.hash.substr(1));
        } else {
            return {};
        }
    };

    function parseQueryString(queryString) {
        var data = {},
            pairs, pair, separatorIndex, escapedKey, escapedValue, key, value;

        if (queryString === null) {
            return data;
        }

        pairs = queryString.split("&");

        for (var i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            separatorIndex = pair.indexOf("=");

            if (separatorIndex === -1) {
                escapedKey = pair;
                escapedValue = null;
            } else {
                escapedKey = pair.substr(0, separatorIndex);
                escapedValue = pair.substr(separatorIndex + 1);
            }

            key = decodeURIComponent(escapedKey);
            value = decodeURIComponent(escapedValue);

            data[key] = value;
        }

        return data;
    }

    return common;
})();

var optionsCalcApp = angular.module('optionsCalc', []);

optionsCalcApp.controller('optionsCalcCtrl', ['$scope', 'optionsCalcService', function ($scope, optionsCalcSvc) {
    $scope.Symbol = 'MSFT';
    $scope.OptionPositions = []; // [{ Name: "Option Pos1", BuySell: "Buy", CallPut: "Put", Contracts: 1, StrikePrice: 41, Premium: 3 }];
    $scope.StockPositions = []; // [{ Name: 'Stock Pos1', Shares: 100, Price: 41 }];

    // Configuration
    $scope.TotalCategories = 12;
    $scope.PriceStep = 0;

    $scope.newOptionPosition = function (event) {
        event.preventDefault();
        $scope.OptionPositions.push({
            Name: "Option Pos" + ($scope.OptionPositions.length + 1),
            BuySell: "Buy", CallPut: "Call", Contracts: 0, StrikePrice: 0
        });
    };

    $scope.newStockPosition = function (event) {
        event.preventDefault();
        $scope.StockPositions.push({
            Name: "Stock Pos" + ($scope.StockPositions.length + 1),
            Shares: 0,
            Price: 0
        });
    };

    $scope.deleteOptionPosition = function (index) {
        if ($scope.OptionPositions.length > index) {
            $scope.OptionPositions.splice(index, 1);
        }
    };

    $scope.deleteStockPosition = function (index) {
        if ($scope.StockPositions.length > index) {
            $scope.StockPositions.splice(index, 1);
        }
    };

    $scope.showConfiguration = function (event) {
        event.preventDefault();
        $(event.target).parents(".card").addClass('flipped');
    };

    $scope.hideConfiguration = function (event) {
        $(event.target).parents(".card").removeClass('flipped');
        $scope.recalc(event);
    };

    $scope.recalc = function (event) {
        event.preventDefault();
        optionsCalcSvc.recalc($scope.Symbol).then($scope.recalcSuccess, $scope.recalcFail);
    };

    $scope.recalcSuccess = function (data) {
        if (data.Status == "SUCCESS") {
            $scope.Name = data.Name;
            $scope.LastPrice = data.LastPrice;
            $scope.Change = data.Change;
            $scope.ChangePercent = data.ChangePercent;
            $scope.Timestamp = new Date(data.Timestamp);
            $scope.MSDate = data.MSDate;
            $scope.MarketCap = data.MarketCap;
            $scope.Volume = data.Volume;
            $scope.ChangeYTD = data.ChangeYTD;
            $scope.ChangePercentYTD = data.ChangePercentYTD;
            $scope.High = data.High;
            $scope.Low = data.Low;
            $scope.Open = data.Open;
        }
        $scope.drawGraph();
    };

    $scope.recalcFail = function (reason) {
        console.error(reason);
    };

    $scope.drawGraph = function () {
        // Calculate categories
        var prices = [];
        if ($scope.PriceStep <= 0) {
            if (+$scope.LastPrice < 20) {
                $scope.PriceStep = 1;
            } else if (+$scope.LastPrice < 60) {
                $scope.PriceStep = 2;
            } else if (+$scope.LastPrice < 100) {
                $scope.PriceStep = 3;
            } else if (+$scope.LastPrice < 150) {
                $scope.PriceStep = 5;
            } else if (+$scope.LastPrice < 200) {
                $scope.PriceStep = 10;
            }
        }

        var price = +$scope.LastPrice + (-$scope.TotalCategories / 2 * +$scope.PriceStep);
        for (var i = 0; i < $scope.TotalCategories; i++) {
            price += +$scope.PriceStep;
            prices.push(Math.round(+price.toFixed(2)));
        }

        var dataSeries = [];
        // Calculate Stock Pos Series
        for (iPos in $scope.StockPositions) {
            var pos = $scope.StockPositions[iPos];
            var posdata = [];
            for (iPrice in prices) {
                var pl = (prices[iPrice] - pos.Price) * pos.Shares;
                posdata.push(+pl.toFixed(2));
            }
            dataSeries.push({ name: pos.Name, data: posdata });
        }

        // Calculate Option Pos Series
        for (iPos in $scope.OptionPositions) {
            var pos = $scope.OptionPositions[iPos];
            var posdata = [];

            var startingPremium = +pos.Premium;
            if (pos.BuySell == "Buy") {
                startingPremium *= -1;
            }

            for (iPrice in prices) {
                var price = prices[iPrice];
                var curPremium = 0; // out of money
                var isInMoney =
                    (pos.CallPut == "Call" && price > pos.StrikePrice) ||
                    (pos.CallPut == "Put" && price < pos.StrikePrice);
                if (isInMoney) {
                    curPremium = Math.abs(price - pos.StrikePrice);
                    if (pos.BuySell == "Sell") {
                        curPremium *= -1;
                    }
                }

                var effectivePremium = +(curPremium + startingPremium).toFixed(2);
                posdata.push(effectivePremium * pos.Contracts * 100);
            }
            dataSeries.push({ name: pos.Name, data: posdata });
        }

        // P&L chart
        var effectivePnLSeries = [];
        var finalDataIter = 0;
        while (finalDataIter < $scope.TotalCategories) {
            var pl = 0;
            for (dsIter in dataSeries) {
                pl += dataSeries[+dsIter].data[finalDataIter];
            }
            finalDataIter++;
            effectivePnLSeries.push(pl);
        }
        dataSeries.push({ name: 'P&L', data: effectivePnLSeries });

        // Set Chart Params
        $('#optionsCalcGraph').highcharts({
            chart: { type: 'line' },
            title: { text: 'Options P/L Calculator' },
            subtitle: { text: 'at the time of maturity' },
            xAxis: { categories: prices },
            yAxis: { title: { text: 'Profit/Loss ($)' } },
            tooltop: { valueSuffix: '$' },
            series: dataSeries
        });
    };
}]);


optionsCalcApp.factory('optionsCalcService', ['$q', '$http', function ($q, $http) {
    return {
        recalc: function (symbol) {
            var deferred = $q.defer();
            var apiUrl = "http://dev.markitondemand.com/Api/v2/Quote/jsonp?callback=JSON_CALLBACK&symbol=" + symbol;
            $http.jsonp(apiUrl).success(deferred.resolve);
            return deferred.promise;
        },
    }
}]);

$(document).ready(function () {
    $(".datepicker").datepicker();
});
