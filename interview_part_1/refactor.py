class DHL:
    def __init__(self, api_key, account_id):
        self.api_key = api_key
        self.account_id = account_id

    def create_shipping_order(self, shipment_data):
        return {"provider": "dhl", "status": "created"}


class Aramex:
    def __init__(self, api_key, password):
        self.api_key = api_key
        self.password = password

    def submit_shipment(self, shipment_data):
        return {"provider": "aramex", "status": "created"}


class FedEx:
    def __init__(self, token):
        self.token = token

    def create_shipment(self, shipment_data):
        return {"provider": "fedex", "status": "created"}


def create_shipment(provider: str, shipment_data: dict):
    if provider == "dhl":
        client = DHL(api_key="DHL_KEY", account_id="DHL_ACCOUNT")
        return client.create_shipping_order(shipment_data)
    elif provider == "aramex":
        client = Aramex(api_key="ARAMEX_KEY", password="ARAMEX_PASS")
        return client.submit_shipment(shipment_data)
    elif provider == "fedex":
        client = FedEx(token="FEDEX_TOKEN")
        return client.create_shipment(shipment_data)
    else:
        raise Exception("Unsupported provider")