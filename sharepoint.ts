// SharePoint write-back via Microsoft Graph API
// Uses the user's SSO access token to write to the FY28 AOP list

interface SharePointItem {
  fields: Record<string, any>;
}

export async function writeToSharePoint(
  accessToken: string,
  data: Record<string, any>
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  const siteUrl = process.env.SHAREPOINT_SITE_URL ?? '';
  const listName = process.env.SHAREPOINT_LIST_NAME ?? 'AOPFY28 IT Portfolio Planning';

  if (!siteUrl || !accessToken) {
    return { success: false, error: 'SharePoint configuration missing' };
  }

  try {
    // Map app fields to SharePoint columns
    const fields: Record<string, any> = {
      Title: data?.projectTitle ?? '',
      Category: data?.category ?? '',
      ProjectClassification: data?.projectClassification ?? '',
      FunctionalArea: data?.functionalArea ?? '',
      ESTCMember: data?.estcMember ?? '',
      ITProductOwner: data?.itProductOwner ?? '',
      OutsideServices: data?.outsideServices ?? 0,
      SoftwareCosts: data?.softwareCosts ?? 0,
      HardwareCost: data?.hardwareCost ?? 0,
      EstimatedNewFundingRequirement: data?.totalFundingRequested ?? 0,
      ITFunded: data?.itFunded ?? 'No',
      // Store new FY28 fields as JSON in comments until SP list is updated
      OtherFinancialComments: JSON.stringify({
        projectNarrative: data?.projectNarrative ?? '',
        incrementalLaborCosts: data?.incrementalLaborCosts ?? 0,
        incrementalFtes: data?.incrementalFtes ?? 0,
        location: data?.location ?? '',
        jobLevel: data?.jobLevel ?? '',
        softwareTerm: data?.softwareTerm ?? null,
        hardwareReceiptDate: data?.hardwareReceiptDate ?? null,
        itFundingAmount: data?.itFundingAmount ?? null,
        bizFunded: data?.bizFunded ?? 'No',
        bizFundingAmount: data?.bizFundingAmount ?? null,
        businessValueDetails: data?.businessValueDetails ?? '',
      }),
    };

    // Get the SharePoint site ID
    const siteHostname = new URL(siteUrl).hostname;
    const sitePath = new URL(siteUrl).pathname;
    const siteRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteHostname}:${sitePath}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );

    if (!siteRes.ok) {
      const errText = await siteRes.text();
      return { success: false, error: `Failed to get site: ${errText}` };
    }

    const site = await siteRes.json();
    const siteId = site?.id;

    // Get the list
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${encodeURIComponent(listName)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return { success: false, error: `Failed to get list: ${errText}` };
    }

    const list = await listRes.json();
    const listId = list?.id;

    // Create the item
    const createRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
        cache: 'no-store',
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { success: false, error: `Failed to create item: ${errText}` };
    }

    const created = await createRes.json();
    return { success: true, itemId: created?.id };
  } catch (err: any) {
    console.error('SharePoint write-back error:', err);
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}
