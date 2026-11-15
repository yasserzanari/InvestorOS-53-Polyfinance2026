import unittest
from types import SimpleNamespace
from unittest.mock import patch
from investoros_api.profiles.supplier_disclosures import official_supplier_documents, public_download

class OfficialSupplierTests(unittest.TestCase):
    @patch('investoros_api.profiles.supplier_disclosures.socket.getaddrinfo',return_value=[(None,None,None,None,('127.0.0.1',443))])
    def test_private_addresses_blocked_before_connection(self,_):
        with self.assertRaises(ValueError):public_download('https://issuer.example/','issuer.example')
    def test_domain_and_credentials_are_rejected(self):
        for uri in ['http://issuer.example/','https://other.example/','https://x@issuer.example/','https://issuer.example:123/']:
            with self.assertRaises(ValueError):public_download(uri,'issuer.example')
    @patch('pypdf.PdfReader')
    @patch('investoros_api.profiles.supplier_disclosures.public_download')
    @patch('investoros_api.profiles.supplier_disclosures.discover_official_site')
    def test_follows_disclosures_linked_by_official_page_and_skips_unread_types(self,site,download,pdf):
        site.return_value={'url':'https://issuer.example/','host':'issuer.example','attribution':'https://www.wikidata.org/wiki/Q1'}
        responses={'https://issuer.example/':(b'<a href="/supplier-responsibility/">Suppliers</a><a href="https://other.example/suppliers.pdf">Other</a>','text/html'),'https://issuer.example/supplier-responsibility/':(b'<h1>Supplier responsibility</h1><a href="/supplier-list.pdf">Supplier list</a>','text/html'),'https://issuer.example/supplier-list.pdf':(b'%PDF-1.7','application/pdf'),'https://other.example/suppliers.pdf':(b'Not a disclosure','text/plain')}
        download.side_effect=lambda url,host:responses[url]
        pdf.return_value=SimpleNamespace(pages=[SimpleNamespace(extract_text=lambda:'Issuer Supplier List: Contoso Components; Fabrikam Manufacturing.')])
        docs=official_supplier_documents('Issuer',None,None)
        self.assertTrue(any(d['url']=='https://issuer.example/supplier-list.pdf' and 'Contoso' in d['text'] for d in docs))
        self.assertEqual(download.call_count,4)
        self.assertEqual({call.args[1] for call in download.call_args_list},{'issuer.example','other.example'})

    @patch('investoros_api.profiles.supplier_disclosures.http.client.HTTPSConnection')
    @patch('investoros_api.profiles.supplier_disclosures.socket.getaddrinfo')
    def test_pdf_redirect_revalidates_destination_and_blocks_private_network(self,dns,https):
        dns.side_effect=[[(None,None,None,None,('93.184.216.34',443))],[(None,None,None,None,('127.0.0.1',443))]]
        response=SimpleNamespace(status=302,getheader=lambda key,default='':'https://127.0.0.1/supplier-list.pdf' if key=='Location' else default)
        https.return_value.getresponse.return_value=response
        with self.assertRaises(ValueError):public_download('https://issuer.example/supplier-list','issuer.example')
        self.assertEqual(https.call_count,1)

    @patch('investoros_api.profiles.supplier_disclosures.socket.create_connection')
    @patch('investoros_api.profiles.supplier_disclosures.http.client.HTTPSConnection')
    @patch('investoros_api.profiles.supplier_disclosures.socket.getaddrinfo',return_value=[(None,None,None,None,('93.184.216.34',443))])
    def test_https_connection_pins_validated_ip_and_preserves_hostname(self,_,https,connect):
        https.return_value.getresponse.return_value=SimpleNamespace(status=200,read=lambda maximum:b'<html>Supplier list</html>',getheader=lambda key,default='':'text/html')
        public_download('https://issuer.example/','issuer.example')
        self.assertEqual(https.call_args.args[0],'issuer.example')
        https.return_value._create_connection(('changed-dns.example',443),7)
        self.assertEqual(connect.call_args.args[0],('93.184.216.34',443))
