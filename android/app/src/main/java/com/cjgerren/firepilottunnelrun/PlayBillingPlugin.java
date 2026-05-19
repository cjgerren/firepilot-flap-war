package com.cjgerren.firepilottunnelrun;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AccountIdentifiers;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin {
    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsCache = new HashMap<>();
    private final List<PendingConnectionAction> pendingConnectionActions = new ArrayList<>();
    private boolean connectionInFlight = false;
    private PluginCall pendingPurchaseCall;
    private String pendingPurchaseProductId;

    @Override
    public void load() {
        ensureBillingClient();
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
            billingClient = null;
        }

        if (pendingPurchaseCall != null) {
            pendingPurchaseCall.reject("Billing session ended before the purchase completed.");
            pendingPurchaseCall = null;
            pendingPurchaseProductId = null;
        }
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        List<String> productIds = getProductIds(call);
        if (productIds == null || productIds.isEmpty()) {
            call.reject("Missing productIds.");
            return;
        }

        ensureBillingReady(call, client -> queryProductsInternal(call, client, productIds));
    }

    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        String productId = safeTrim(call.getString("productId"));
        if (productId == null) {
            call.reject("Missing productId.");
            return;
        }

        if (pendingPurchaseCall != null) {
            call.reject("Another Play purchase is already in progress.");
            return;
        }

        String obfuscatedAccountId = normalizeObfuscatedAccountId(call.getString("obfuscatedAccountId"));
        call.save();
        pendingPurchaseCall = call;
        pendingPurchaseProductId = productId;

        ArrayList<String> purchaseIds = new ArrayList<>();
        purchaseIds.add(productId);

        ensureBillingReady(call, client -> queryProductsInternal(
            null,
            client,
            purchaseIds,
            productDetailsList -> launchPurchaseFlow(client, productId, obfuscatedAccountId, productDetailsList),
            errorMessage -> failPendingPurchase(errorMessage)
        ));
    }

    @PluginMethod
    public void getUnconsumedPurchases(PluginCall call) {
        ensureBillingReady(call, client -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

            client.queryPurchasesAsync(params, new PurchasesResponseListener() {
                @Override
                public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
                    if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        call.reject(billingErrorMessage("Unable to query Play purchases", billingResult));
                        return;
                    }

                    JSArray items = new JSArray();
                    for (Purchase purchase : purchases) {
                        items.put(purchaseToJsObject(purchase));
                    }

                    JSObject result = new JSObject();
                    result.put("purchases", items);
                    call.resolve(result);
                }
            });
        });
    }

    private void ensureBillingClient() {
        if (billingClient != null) {
            return;
        }

        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this::handlePurchasesUpdated)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .build();
    }

    private void ensureBillingReady(PluginCall call, ReadyAction action) {
        ensureBillingClient();

        if (billingClient.isReady()) {
            action.run(billingClient);
            return;
        }

        pendingConnectionActions.add(new PendingConnectionAction(call, action));

        if (connectionInFlight) {
            return;
        }

        connectionInFlight = true;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                connectionInFlight = false;

                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectPendingConnectionActions(billingErrorMessage("Play Billing setup failed", billingResult));
                    return;
                }

                List<PendingConnectionAction> actions = new ArrayList<>(pendingConnectionActions);
                pendingConnectionActions.clear();
                for (PendingConnectionAction pendingAction : actions) {
                    pendingAction.action.run(billingClient);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connectionInFlight = false;
            }
        });
    }

    private void rejectPendingConnectionActions(String message) {
        List<PendingConnectionAction> actions = new ArrayList<>(pendingConnectionActions);
        pendingConnectionActions.clear();

        for (PendingConnectionAction pendingAction : actions) {
            if (pendingAction.call != null) {
                pendingAction.call.reject(message);
                if (pendingAction.call == pendingPurchaseCall) {
                    pendingPurchaseCall = null;
                    pendingPurchaseProductId = null;
                }
            }
        }
    }

    private void queryProductsInternal(
        @Nullable PluginCall call,
        BillingClient client,
        List<String> productIds
    ) {
        queryProductsInternal(call, client, productIds, productDetailsList -> {
            JSArray products = new JSArray();
            for (ProductDetails productDetails : productDetailsList) {
                products.put(productDetailsToJsObject(productDetails));
            }

            if (call != null) {
                JSObject result = new JSObject();
                result.put("products", products);
                call.resolve(result);
            }
        }, errorMessage -> {
            if (call != null) {
                call.reject(errorMessage);
            }
        });
    }

    private void queryProductsInternal(
        @Nullable PluginCall call,
        BillingClient client,
        List<String> productIds,
        ProductDetailsSuccessHandler onSuccess,
        ProductDetailsErrorHandler onError
    ) {
        ArrayList<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : productIds) {
            products.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            );
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(products)
            .build();

        client.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                onError.handle(billingErrorMessage("Unable to load Play products", billingResult));
                return;
            }

            List<ProductDetails> productDetailsList = queryResult.getProductDetailsList();
            if (productDetailsList == null || productDetailsList.isEmpty()) {
                onError.handle("Google Play did not return any matching in-app products.");
                return;
            }

            productDetailsCache.clear();
            for (ProductDetails details : productDetailsList) {
                productDetailsCache.put(details.getProductId(), details);
            }

            onSuccess.handle(productDetailsList);
        });
    }

    private void launchPurchaseFlow(
        BillingClient client,
        String productId,
        @Nullable String obfuscatedAccountId,
        List<ProductDetails> productDetailsList
    ) {
        ProductDetails productDetails = null;
        for (ProductDetails details : productDetailsList) {
            if (productId.equals(details.getProductId())) {
                productDetails = details;
                break;
            }
        }

        if (productDetails == null) {
            failPendingPurchase("Google Play product " + productId + " is not available for purchase.");
            return;
        }

        ProductDetails.OneTimePurchaseOfferDetails offerDetails = getPrimaryOfferDetails(productDetails);
        if (offerDetails == null) {
            failPendingPurchase("Google Play did not return a purchase offer for " + productId + ".");
            return;
        }

        BillingFlowParams.ProductDetailsParams.Builder productDetailsParams =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(offerDetails.getOfferToken());

        ArrayList<BillingFlowParams.ProductDetailsParams> paramsList = new ArrayList<>();
        paramsList.add(productDetailsParams.build());

        BillingFlowParams.Builder billingFlowBuilder = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(paramsList);

        if (obfuscatedAccountId != null) {
            billingFlowBuilder.setObfuscatedAccountId(obfuscatedAccountId);
        }

        BillingResult launchResult = client.launchBillingFlow(getActivity(), billingFlowBuilder.build());
        if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            failPendingPurchase(billingErrorMessage("Unable to launch Google Play purchase flow", launchResult));
        }
    }

    private void handlePurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        if (pendingPurchaseCall == null) {
            return;
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            resolvePendingPurchase("cancelled", null);
            return;
        }

        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            failPendingPurchase(billingErrorMessage("Google Play purchase failed", billingResult));
            return;
        }

        if (purchases == null || purchases.isEmpty()) {
            failPendingPurchase("Google Play did not return a purchase.");
            return;
        }

        Purchase selectedPurchase = null;
        for (Purchase purchase : purchases) {
            if (purchase.getProducts().contains(pendingPurchaseProductId)) {
                selectedPurchase = purchase;
                break;
            }
        }

        if (selectedPurchase == null) {
            selectedPurchase = purchases.get(0);
        }

        switch (selectedPurchase.getPurchaseState()) {
            case Purchase.PurchaseState.PENDING:
                resolvePendingPurchase("pending", selectedPurchase);
                break;
            case Purchase.PurchaseState.PURCHASED:
                resolvePendingPurchase("purchased", selectedPurchase);
                break;
            default:
                resolvePendingPurchase("unknown", selectedPurchase);
                break;
        }
    }

    @Nullable
    private ProductDetails.OneTimePurchaseOfferDetails getPrimaryOfferDetails(ProductDetails productDetails) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = productDetails.getOneTimePurchaseOfferDetailsList();
        if (offers == null || offers.isEmpty()) {
            return null;
        }

        return offers.get(0);
    }

    private JSObject productDetailsToJsObject(ProductDetails productDetails) {
        JSObject product = new JSObject();
        ProductDetails.OneTimePurchaseOfferDetails offerDetails = getPrimaryOfferDetails(productDetails);

        product.put("productId", productDetails.getProductId());
        product.put("title", productDetails.getTitle());
        product.put("description", productDetails.getDescription());
        product.put("displayPrice", offerDetails != null ? offerDetails.getFormattedPrice() : null);
        product.put("priceCurrencyCode", offerDetails != null ? offerDetails.getPriceCurrencyCode() : null);
        product.put("priceAmountMicros", offerDetails != null ? offerDetails.getPriceAmountMicros() : null);
        product.put("offerToken", offerDetails != null ? offerDetails.getOfferToken() : null);
        return product;
    }

    private JSObject purchaseToJsObject(Purchase purchase) {
        JSObject purchaseData = new JSObject();
        JSArray productIds = new JSArray();
        for (String productId : purchase.getProducts()) {
            productIds.put(productId);
        }

        AccountIdentifiers accountIdentifiers = purchase.getAccountIdentifiers();

        purchaseData.put("productIds", productIds);
        purchaseData.put("orderId", purchase.getOrderId());
        purchaseData.put("purchaseToken", purchase.getPurchaseToken());
        purchaseData.put("purchaseTime", purchase.getPurchaseTime());
        purchaseData.put("quantity", purchase.getQuantity());
        purchaseData.put("acknowledged", purchase.isAcknowledged());
        purchaseData.put("purchaseState", purchase.getPurchaseState());
        purchaseData.put("purchaseStateName", purchaseStateName(purchase.getPurchaseState()));
        purchaseData.put(
            "obfuscatedAccountId",
            accountIdentifiers != null ? accountIdentifiers.getObfuscatedAccountId() : null
        );

        return purchaseData;
    }

    private String purchaseStateName(int purchaseState) {
        if (purchaseState == Purchase.PurchaseState.PURCHASED) {
            return "purchased";
        }

        if (purchaseState == Purchase.PurchaseState.PENDING) {
            return "pending";
        }

        return "unspecified";
    }

    private void resolvePendingPurchase(String status, @Nullable Purchase purchase) {
        if (pendingPurchaseCall == null) {
            return;
        }

        JSObject result = new JSObject();
        result.put("status", status);
        if (purchase != null) {
            result.put("purchase", purchaseToJsObject(purchase));
        }

        pendingPurchaseCall.resolve(result);
        pendingPurchaseCall = null;
        pendingPurchaseProductId = null;
    }

    private void failPendingPurchase(String message) {
        if (pendingPurchaseCall == null) {
            return;
        }

        pendingPurchaseCall.reject(message);
        pendingPurchaseCall = null;
        pendingPurchaseProductId = null;
    }

    @Nullable
    private List<String> getProductIds(PluginCall call) {
        JSArray productIdsArray = call.getArray("productIds");
        if (productIdsArray == null) {
            return null;
        }

        ArrayList<String> productIds = new ArrayList<>();
        for (int index = 0; index < productIdsArray.length(); index++) {
            String productId = safeTrim(productIdsArray.optString(index, null));
            if (productId != null) {
                productIds.add(productId);
            }
        }

        return productIds;
    }

    @Nullable
    private String normalizeObfuscatedAccountId(@Nullable String value) {
        String trimmed = safeTrim(value);
        if (trimmed == null) {
            return null;
        }

        if (trimmed.length() > 64) {
            return trimmed.substring(0, 64);
        }

        return trimmed;
    }

    @Nullable
    private String safeTrim(@Nullable String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String billingErrorMessage(String prefix, BillingResult billingResult) {
        String debugMessage = billingResult.getDebugMessage();
        if (debugMessage == null || debugMessage.isEmpty()) {
            return prefix + " (code " + billingResult.getResponseCode() + ").";
        }

        return prefix + " (code " + billingResult.getResponseCode() + "): " + debugMessage;
    }

    private interface ReadyAction {
        void run(BillingClient client);
    }

    private interface ProductDetailsSuccessHandler {
        void handle(List<ProductDetails> productDetailsList);
    }

    private interface ProductDetailsErrorHandler {
        void handle(String errorMessage);
    }

    private static class PendingConnectionAction {
        final PluginCall call;
        final ReadyAction action;

        PendingConnectionAction(@Nullable PluginCall call, @NonNull ReadyAction action) {
            this.call = call;
            this.action = action;
        }
    }
}
