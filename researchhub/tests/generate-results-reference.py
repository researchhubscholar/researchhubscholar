"""Rebuild fixtures using SciPy 1.17.0; no participant data or network calls.
References: scipy.stats.ttest_ind(equal_var=False), pearsonr, chi2_contingency(correction=False).
"""
import json, random
from pathlib import Path
from scipy import stats
rng=random.Random(4281)
cases=[]
for n in [4,9,20,35]:
 a=[rng.gauss(10,2) for _ in range(n)]
 b=[rng.gauss(12,5) for _ in range(n+3)]
 r=stats.ttest_ind(a,b,equal_var=False); ci=r.confidence_interval()
 cases.append(dict(kind='welch',rows=[[str(v),'A'] for v in a]+[[str(v),'B'] for v in b],statistic=float(r.statistic),p=float(r.pvalue),df=float(r.df),estimate=sum(a)/len(a)-sum(b)/len(b),ci=[float(ci.low),float(ci.high)]))
 x=[rng.gauss(0,2) for _ in range(n+4)]; y=[-v*.8+rng.gauss(0,2) for v in x]
 r=stats.pearsonr(x,y);ci=r.confidence_interval()
 cases.append(dict(kind='pearson',rows=[[str(v),str(w)] for v,w in zip(x,y)],statistic=float(r.statistic),p=float(r.pvalue),df=len(x)-2,estimate=float(r.statistic),ci=[float(ci.low),float(ci.high)]))
for table in [[[10,20],[20,10]],[[30,20,15],[20,25,30]],[[15,15],[15,15]],[[22,40,18],[17,38,35],[19,26,22]]]:
 r=stats.chi2_contingency(table,correction=False)
 rows=[[f'G{i}',f'C{j}'] for i,row in enumerate(table) for j,count in enumerate(row) for _ in range(count)]
 cases.append(dict(kind='chi2',rows=rows,statistic=float(r.statistic),p=float(r.pvalue),df=int(r.dof),estimate=(float(r.statistic)/(len(rows)*min(len(table)-1,len(table[0])-1)))**.5,ci=None))
Path('tests/results-reference.json').write_text(json.dumps(cases,indent=2))
